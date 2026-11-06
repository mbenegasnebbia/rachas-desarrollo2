import { useState } from "react";
import { Redirect } from "expo-router";
import { Text, View } from "react-native";
import { completarPerfil } from "@/api/personas";
import { useSesion } from "@/session/Sesion";
import { useAccion } from "@/hooks/useCarga";
import { mensajeErrorAuth } from "@/auth/session";
import {
  Aviso,
  Boton,
  Campo,
  EstadoCarga,
  Pantalla,
  estilos,
} from "@/components/UI";
import { validarPerfil } from "@/utils/validaciones";

export default function Ingreso() {
  const sesion = useSesion();
  const accion = useAccion();
  const [alias, setAlias] = useState("");
  const [nombre, setNombre] = useState("");
  const [zona, setZona] = useState("America/Argentina/Buenos_Aires");
  if (sesion.persona?.perfilCompleto) return <Redirect href="/(tabs)" />;
  return (
    <Pantalla>
      <Text style={estilos.titulo}>Un hábito, día a día.</Text>
      <EstadoCarga
        cargando={sesion.cargando}
        error={sesion.error}
        reintentar={sesion.reintentar}
      />
      <Aviso texto={accion.error} />
      {!sesion.cargando && !sesion.usuarioFirebase ? (
        <Boton
          titulo={
            accion.ocupado ? "Conectando con Google…" : "Continuar con Google"
          }
          disabled={accion.ocupado}
          onPress={() =>
            void accion.ejecutar(async () => {
              try {
                await sesion.ingresar();
              } catch (e) {
                throw new Error(mensajeErrorAuth(e));
              }
            })
          }
        />
      ) : null}
      {!sesion.cargando && sesion.persona ? (
        <View style={estilos.tarjeta}>
          <Text style={estilos.subtitulo}>Completá tu perfil</Text>
          <Text style={estilos.texto}>
            Elegí un alias para participar en Rachas.
          </Text>
          <Campo
            etiqueta="Alias (3 a 20 letras, números o guion bajo)"
            value={alias}
            autoCapitalize="none"
            maxLength={20}
            onChangeText={setAlias}
          />
          <Campo
            etiqueta="Nombre"
            value={nombre || sesion.persona.nombre}
            onChangeText={setNombre}
          />
          <Campo
            etiqueta="Zona horaria IANA"
            value={zona}
            autoCapitalize="none"
            onChangeText={setZona}
          />
          <Boton
            titulo="Guardar perfil y continuar"
            disabled={accion.ocupado}
            onPress={() =>
              void accion.ejecutar(async () => {
                if (!/^[a-zA-Z0-9_]{3,20}$/.test(alias))
                  throw new Error(
                    "Ingresá un alias válido de 3 a 20 caracteres.",
                  );
                const nombreFinal =
                  nombre.trim() || sesion.persona?.nombre || "";
                validarPerfil(nombreFinal, zona);
                const perfil = await completarPerfil({
                  alias,
                  nombre: nombreFinal,
                  zonaHoraria: zona,
                });
                await sesion.guardar(perfil);
              })
            }
          />
        </View>
      ) : null}
      {sesion.usuarioFirebase ? (
        <Boton
          titulo="Cerrar sesión"
          secundario
          disabled={accion.ocupado || sesion.cargando}
          onPress={() => void accion.ejecutar(() => sesion.guardar(null))}
        />
      ) : null}
    </Pantalla>
  );
}
