export interface PeriodoModel {
  idPeriodo?: number;
  nombrePeriodo: string;
  fechaInicial: string;
  fechaFinal: string;
}

export interface CreatePeriodoDto {
  nombrePeriodo: string;
  fechaInicial: string;
  fechaFinal: string;
}

export interface UpdatePeriodoDto extends Partial<CreatePeriodoDto> {}
