import { useCallback, useState } from "react";
import { Redirect } from "expo-router";
import { Text, View } from "react-native";
import { listarPersonas, registrar } from "@/api/personas";
import { useSesion } from "@/session/Sesion";
import { useCarga, useAccion } from "@/hooks/useCarga";
import {
  Aviso,
  Boton,
  Campo,
  EstadoCarga,
  Pantalla,
  estilos,
} from "@/components/UI";
import { validarRegistro } from "@/utils/validaciones";
export default function Ingreso() {
  const sesion = useSesion();
  const carga = useCarga(useCallback(() => listarPersonas(), []));
  const accion = useAccion();
  const [nombre, setNombre] = useState(""),
    [alias, setAlias] = useState(""),
    [email, setEmail] = useState(""),
    [zona, setZona] = useState("America/Argentina/Buenos_Aires");
  if (sesion.persona) return <Redirect href="/(tabs)" />;
  return (
    <Pantalla refrescar={carga.cargar} cargando={carga.cargando}>
      <Text style={estilos.titulo}>Un hábito, día a día.</Text>
      <Text style={estilos.texto}>
        Elegí tu persona o registrate para empezar. El ingreso es provisorio
        hasta la parte III.
      </Text>
      <EstadoCarga
        {...carga}
        vacio={carga.datos?.length === 0}
        reintentar={carga.cargar}
      />
      {carga.datos?.map((p) => (
        <Boton
          key={p.id}
          titulo={p.nombre + " · @" + p.alias}
          disabled={accion.ocupado}
          onPress={() => void accion.ejecutar(() => sesion.guardar(p))}
        />
      ))}
      <View style={estilos.tarjeta}>
        <Text style={estilos.subtitulo}>Crear persona</Text>
        <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} />
        <Campo
          etiqueta="Alias"
          autoCapitalize="none"
          maxLength={20}
          value={alias}
          onChangeText={setAlias}
        />
        <Campo
          etiqueta="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <Campo
          etiqueta="Zona horaria IANA"
          autoCapitalize="none"
          value={zona}
          onChangeText={setZona}
        />
        <Aviso texto={accion.error} />
        <Boton
          titulo="Registrarme"
          disabled={accion.ocupado}
          onPress={() =>
            void accion.ejecutar(async () => {
              validarRegistro(nombre, alias, email, zona);
              const p = await registrar({
                nombre: nombre.trim(),
                alias,
                email: email.trim(),
                zonaHoraria: zona,
              });
              await sesion.guardar(p);
            })
          }
        />
      </View>
    </Pantalla>
  );
}
