import { CursoModel } from '../../cursos/models/curso.model';
import { EstudianteModel } from '../../estudiantes/models/estudiante.model';
import { PeriodoModel } from '../../periodos/models/periodo.model';

export interface BoletinPublicadoModel {
  id?: number;
  idBoletin?: number;
  estudianteId: number;
  periodoId: number;
  cursoId?: number;
  archivoUrl?: string;
  url?: string;
  fileUrl?: string;
  downloadUrl?: string;
  estado?: 'borrador' | 'publicado' | 'anulado' | string;
  promedio?: number;
  fechaGeneracion?: string;
  createdAt?: string;
  updatedAt?: string;
  estudiante?: EstudianteModel;
  periodo?: PeriodoModel;
  curso?: CursoModel;
}

export interface PublicarBoletinDto {
  estudianteId: number;
  periodoId: number;
  cursoId?: number;
  promedio: number;
  estado: 'publicado';
  nombreArchivo: string;
  html: string;
  metadata: {
    estudiante: string;
    documento: string;
    curso: string;
    periodo: string;
    promedioLabel: string;
    resultado: string;
  };
}

export interface PublicarBoletinesDto {
  boletines: PublicarBoletinDto[];
}
