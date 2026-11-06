import { useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import {
  cerrarGooglePrueba,
  diagnosticoErrorGoogle,
  ingresarGooglePrueba,
  resultadoErrorGoogle,
  type UsuarioGooglePrueba,
} from "@/auth/google.web";
import { obtenerAuthPrueba } from "@/auth/firebase.web";
import { Aviso, Boton, estilos } from "./UI";

type Estado = "inicial" | "cargando" | "autenticado" | "cancelado" | "error";

interface IdentidadNest {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  provider: string | null;
}

export function GooglePrueba() {
  const [estado, setEstado] = useState<Estado>("inicial");
  const [usuario, setUsuario] = useState<UsuarioGooglePrueba | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [diagnostico, setDiagnostico] = useState("");
  const bloqueo = useRef(false);
  const [verificando, setVerificando] = useState(false);
  const [httpNest, setHttpNest] = useState<number | null>(null);
  const [identidadNest, setIdentidadNest] = useState<IdentidadNest | null>(null);
  const [errorNest, setErrorNest] = useState("");

  async function verificarNest() {
    if (!__DEV__ || bloqueo.current || !usuario) return;
    bloqueo.current = true;
    setVerificando(true);
    setHttpNest(null);
    setIdentidadNest(null);
    setErrorNest("");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let tokenObtenido = false;
    try {
      const user = obtenerAuthPrueba().currentUser;
      if (!user || user.uid !== usuario.uid) {
        setErrorNest("La identidad de Firebase cambió. Cerrá la prueba e ingresá nuevamente.");
        return;
      }
      const token = await user.getIdToken();
      tokenObtenido = true;
      const response = await fetch("http://localhost:3001/auth/me", {
        method: "GET",
        headers: { Authorization: "Bearer " + token },
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
      });
      setHttpNest(response.status);
      if (!response.ok) {
        setErrorNest(
          response.status === 401
            ? "NestJS rechazó el token (401). Revisá que Firebase Web y Admin usen el mismo proyecto y volvé a ingresar."
            : response.status === 503
              ? "La autenticación de NestJS no está disponible (503). Revisá el proyecto y las credenciales ADC del backend."
              : "NestJS no pudo verificar la identidad. Revisá el código HTTP.",
        );
        return;
      }
      const data: unknown = await response.json();
      if (
        typeof data !== "object" || data === null ||
        !("uid" in data) || typeof data.uid !== "string" ||
        !("email" in data) || !(data.email === null || typeof data.email === "string") ||
        !("emailVerified" in data) || typeof data.emailVerified !== "boolean" ||
        !("name" in data) || !(data.name === null || typeof data.name === "string") ||
        !("provider" in data) || !(data.provider === null || typeof data.provider === "string")
      ) {
        setErrorNest("NestJS devolvió un formato de identidad inesperado.");
        return;
      }
      // Lista explícita: nunca renderizar el cuerpo completo ni los headers.
      setIdentidadNest({
        uid: data.uid,
        email: data.email,
        emailVerified: data.emailVerified,
        name: data.name,
        provider: data.provider,
      });
    } catch {
      // No registrar excepciones ni requests: pueden contener Authorization.
      setErrorNest(
        controller.signal.aborted
          ? "La verificación tardó demasiado. Revisá el backend y reintentá."
          : !tokenObtenido
            ? "No se pudo obtener el token vigente. Volvé a ingresar con Google."
            : "No se pudo completar la consulta a NestJS. Revisá la conexión, el puerto 3001 y CORS para el origen de Expo Web.",
      );
    } finally {
      clearTimeout(timeout);
      bloqueo.current = false;
      setVerificando(false);
    }
  }

  async function ejecutar(cerrar = false) {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setEstado("cargando");
    setMensaje("");
    setDiagnostico("");
    setHttpNest(null);
    setIdentidadNest(null);
    setErrorNest("");
    try {
      if (cerrar) {
        await cerrarGooglePrueba();
        setUsuario(null);
        setEstado("inicial");
        setMensaje("Prueba de Google cerrada.");
      } else {
        // La llamada al popup empieza en el evento del botón, sin una carga previa.
        const autenticado = await ingresarGooglePrueba();
        setUsuario(autenticado);
        setEstado("autenticado");
      }
    } catch (error) {
      const resultado = resultadoErrorGoogle(error);
      if (__DEV__) setDiagnostico(diagnosticoErrorGoogle(error));
      setEstado(resultado.cancelado ? "cancelado" : "error");
      setMensaje(resultado.mensaje);
    } finally {
      bloqueo.current = false;
    }
  }

  return (
    <View style={estilos.tarjeta}>
      <Text style={estilos.subtitulo}>Google · Prueba de autenticación</Text>
      <Text style={estilos.texto}>
        Esta prueba verifica tu cuenta con Firebase. No inicia una sesión de
        Rachas, no vincula personas ni habilita acceso a sus pantallas.
      </Text>
      {estado === "cargando" ? (
        <ActivityIndicator accessibilityLabel="Procesando autenticación con Google" color="#256448" />
      ) : null}
      {usuario ? (
        <>
          <Text style={estilos.texto}>Firebase devolvió un usuario autenticado.</Text>
          <Text style={estilos.texto}>Nombre: {usuario.nombre ?? "Sin nombre"}</Text>
          <Text style={estilos.texto}>Email: {usuario.email ?? "No disponible"}</Text>
          <Text selectable style={estilos.texto}>UID: {usuario.uid}</Text>
          {__DEV__ ? (
            <View style={estilos.tarjeta}>
              <Boton
                titulo={verificando ? "Verificando identidad…" : "Verificar identidad en NestJS"}
                disabled={verificando || estado === "cargando"}
                onPress={() => void verificarNest()}
              />
              {httpNest !== null ? (
                <Text style={estilos.texto}>HTTP: {httpNest}</Text>
              ) : null}
              <Aviso texto={errorNest} />
              {identidadNest ? (
                <View accessibilityLiveRegion="polite">
                  <Text style={estilos.texto}>Identidad verificada por NestJS.</Text>
                  <Text selectable style={estilos.texto}>UID: {identidadNest.uid}</Text>
                  <Text style={estilos.texto}>Nombre: {identidadNest.name ?? "No disponible"}</Text>
                  <Text style={estilos.texto}>Email: {identidadNest.email ?? "No disponible"}</Text>
                  <Text style={estilos.texto}>Email verificado: {identidadNest.emailVerified ? "Sí" : "No"}</Text>
                  <Text style={estilos.texto}>Proveedor: {identidadNest.provider ?? "No disponible"}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <Boton
            titulo="Cerrar prueba de Google"
            secundario
            disabled={estado === "cargando" || verificando}
            onPress={() => void ejecutar(true)}
          />
        </>
      ) : (
        <Boton
          titulo={estado === "cargando" ? "Conectando con Google…" : "Continuar con Google"}
          disabled={estado === "cargando"}
          onPress={() => void ejecutar()}
        />
      )}
      {estado === "error" ? <Aviso texto={mensaje} /> : (
        <Text accessibilityLiveRegion="polite" style={estilos.texto}>{mensaje}</Text>
      )}
      {__DEV__ && diagnostico ? (
        <View style={estilos.tarjeta}>
          <Text style={estilos.subtitulo}>Diagnóstico de desarrollo</Text>
          <Text selectable accessibilityLiveRegion="polite" style={estilos.texto}>
            {diagnostico}
          </Text>
        </View>
      ) : null}
      <Text style={estilos.etiqueta}>
        La autenticación de prueba se mantiene solo en memoria y se pierde al recargar.
        Podés seguir usando el ingreso provisional de abajo.
      </Text>
    </View>
  );
}
