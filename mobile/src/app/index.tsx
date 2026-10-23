  import { useCallback, useEffect, useState } from 'react';
  import {
    ActivityIndicator,
    Button,
    FlatList,
    StyleSheet,
    Text,
    View,
  } from 'react-native';
  import { listarDesafios } from '@/api/desafios';
  import { colores } from '@/theme';
  import type { Desafio } from '@/types';

  type Estado = 'PROGRAMADO' | 'ACTIVO' | 'FINALIZADO' | 'CANCELADO';

  // El back no devuelve "estado" en el listado: se calcula igual que en el back.
  function calcularEstado(d: Desafio): Estado {
    if (d.cancelado) return 'CANCELADO';
    const hoy = new Date().toISOString().slice(0, 10);
    if (hoy < d.fechaInicio.slice(0, 10)) return 'PROGRAMADO';
    if (hoy > d.fechaFin.slice(0, 10)) return 'FINALIZADO';
    return 'ACTIVO';
  }

  function formatearFecha(iso: string): string {
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }

  export default function Inicio() {
    const [desafios, setDesafios] = useState<Desafio[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cargar = useCallback(async () => {
      setCargando(true);
      setError(null);
      try {
        setDesafios(await listarDesafios());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error desconocido');
      } finally {
        setCargando(false);
      }
    }, []);

    useEffect(() => {
      cargar();
    }, [cargar]);

    if (cargando) {
      return (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color={colores.primario} />
          <Text style={styles.msg}>Cargando desafíos...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centro}>
          <Text style={styles.error}>No se pudieron cargar los desafíos</Text>
          <Text style={styles.msg}>{error}</Text>
          <Button title="Reintentar" color={colores.primario} onPress={cargar} />
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Rachas 🔥</Text>
        <FlatList
          data={desafios}
          keyExtractor={(d) => d.id}
          ListEmptyComponent={<Text style={styles.msg}>No hay desafíos todavía.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.nombre}>{item.nombre}</Text>
              <Text style={styles.dato}>Categoría: {item.categoria}</Text>
              <Text style={styles.dato}>Estado: {calcularEstado(item)}</Text>
              <Text style={styles.dato}>
                {formatearFecha(item.fechaInicio)} → {formatearFecha(item.fechaFin)}
              </Text>
            </View>
          )}
        />
      </View>
    );
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colores.fondo, padding: 16, paddingTop: 56 },
    centro: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colores.fondo,
      padding: 24,
      gap: 12,
    },
    title: { fontSize: 28, fontWeight: 'bold', marginBottom: 12, color: colores.texto },
    card: {
      backgroundColor: '#fff',
      borderRadius: 8,
      padding: 12,
      marginBottom: 10,
      elevation: 2,
    },
    nombre: { fontSize: 18, fontWeight: '600', color: colores.texto, marginBottom: 4 },
    dato: { color: colores.texto },
    msg: { color: colores.texto, textAlign: 'center' },
    error: { color: '#C62828', fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
  });
