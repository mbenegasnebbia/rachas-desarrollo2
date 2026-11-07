import { Badge } from "@/components/ui/badge";
import type { EstadoSolicitud as Estado } from "@/types";

const estados = {
  PENDING: { texto: "Pendiente", tono: "advertencia" },
  APPROVED: { texto: "Aprobada", tono: "exito" },
  REJECTED: { texto: "Rechazada", tono: "error" },
  CANCELLED: { texto: "Cancelada", tono: "neutro" },
} as const;

export function EstadoSolicitud({ estado }: { estado: Estado }) {
  return <Badge {...estados[estado]} />;
}
