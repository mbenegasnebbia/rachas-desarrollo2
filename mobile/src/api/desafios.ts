import { request } from './client';
import type { Desafio } from '@/types';

export function listarDesafios(): Promise<Desafio[]> {
  return request<Desafio[]>('/desafios');
}
