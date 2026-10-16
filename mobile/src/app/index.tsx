import { StyleSheet, Text, View } from 'react-native';
import { colores } from '@/theme';

export default function Inicio() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rachas 🔥</Text>
      <Text>Mis desafíos</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colores.fondo,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
  },
});
