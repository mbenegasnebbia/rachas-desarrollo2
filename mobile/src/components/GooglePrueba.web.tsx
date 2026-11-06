import { useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import {
  cerrarGooglePrueba,
  diagnosticoErrorGoogle,
  ingresarGooglePrueba,
  resultadoErrorGoogle,
  type UsuarioGooglePrueba,
} from "@/auth/google.web";
import { Aviso, Boton, estilos } from "./UI";

type Estado = "inicial" | "cargando" | "autenticado" | "cancelado" | "error";

export function GooglePrueba() {
  const [estado, setEstado] = useState<Estado>("inicial");
  const [usuario, setUsuario] = useState<UsuarioGooglePrueba | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [diagnostico, setDiagnostico] = useState("");
  const bloqueo = useRef(false);

  async function ejecutar(cerrar = false) {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setEstado("cargando");
    setMensaje("");
    setDiagnostico("");
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
          <Boton
            titulo="Cerrar prueba de Google"
            secundario
            disabled={estado === "cargando"}
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
