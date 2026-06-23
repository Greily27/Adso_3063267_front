import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CustomTable, TableColumn } from '../../shared/components/custom-table/custom-table';
import { MateriasForm } from './components/materias-form/materias-form';
import { CreateMateriaDto, MateriaModel, UpdateMateriaDto } from './models/materia.model';
import { MateriasService } from './services/materias-service';
import { CursoModel } from '../cursos/models/curso.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-materias',
  imports: [CommonModule, MatButtonModule, MatDialogModule, CustomTable],
  templateUrl: './materias.html',
  styleUrl: './materias.scss',
})
export class Materias {
  private materiasService = inject(MateriasService);
  public errorMessage = '';

  public columns: TableColumn[] = [
    { label: 'ID', key: 'idMateria' },
    { label: 'Nombre', key: 'nombreMateria' },
    { label: 'Estado', key: 'estadoLabel' },
    { label: 'Cursos', key: 'cursosLabel' }
  ];

  public materiasForTable = computed(() => this.materiasService.materias().map(materia => ({
    ...materia,
    estadoLabel: materia.estado ? 'Activa' : 'Inactiva',
    cursosLabel: this.getCursosLabel(materia)
  })));

  constructor(private dialog: MatDialog) {}

  openDialog() {
    const dialogRef = this.dialog.open(MateriasForm, { width: '550px' });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const materiaDto: CreateMateriaDto = this.toDto(result);

        this.errorMessage = '';

        if (this.materiaExists(materiaDto.nombreMateria)) {
          this.errorMessage = `Ya existe una materia llamada "${materiaDto.nombreMateria}".`;
          this.showError('Materia duplicada', this.errorMessage);
          return;
        }

        this.materiasService.createMateria(materiaDto).subscribe({
          next: (response: MateriaModel) => this.showSuccess('Materia creada', `${this.getMateriaName(response)} se guardo correctamente.`),
          error: (err: HttpErrorResponse) => {
            console.error('Error al guardar', err);
            this.errorMessage = this.getErrorMessage(err, 'No se pudo crear la materia.');
            this.showError('Error al guardar', this.errorMessage);
          }
        });
      }
    });
  }

  handleEdit(materia: MateriaModel) {
    const dialogRef = this.dialog.open(MateriasForm, { width: '550px', data: materia });

    dialogRef.afterClosed().subscribe(result => {
      if (result && materia.idMateria) {
        const materiaDto: UpdateMateriaDto = this.toDto(result);

        this.errorMessage = '';

        this.materiasService.updateMateria(materia.idMateria, materiaDto).subscribe({
          next: response => this.showSuccess('Materia actualizada', `${this.getMateriaName(response)} se actualizó correctamente.`),
          error: (err: HttpErrorResponse) => {
            console.error('Error al actualizar', err);
            this.errorMessage = this.getErrorMessage(err, 'No se pudo actualizar la materia.');
            this.showError('Error al actualizar', this.errorMessage);
          }
        });
      }
    });
  }

  async handleDelete(materia: MateriaModel) {
    if (materia.idMateria !== undefined) {
      const result = await Swal.fire({
        icon: 'warning',
        title: 'Eliminar materia',
        text: `Estas seguro de eliminar ${this.getMateriaName(materia)}?`,
        showCancelButton: true,
        confirmButtonText: 'Si, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#b4232f'
      });

      if (!result.isConfirmed) return;
      this.errorMessage = '';

      this.materiasService.deleteMateria(materia.idMateria).subscribe({
        next: () => this.showSuccess('Materia eliminada', 'La materia se eliminó correctamente.'),
        error: (err: HttpErrorResponse) => {
          console.error('Error al eliminar', err);
          this.errorMessage = this.getErrorMessage(err, 'No se pudo eliminar la materia.');
          this.showError('Error al eliminar', this.errorMessage);
        }
      });
    }
  }

  private toDto(formValue: {
    nombreMateria: string;
    estado: boolean;
    cursos?: CursoModel[];
  }): CreateMateriaDto {
    const cursosIds = (formValue.cursos ?? [])
      .map(curso => curso.id ?? curso.idCurso ?? curso.cursoId)
      .filter((id): id is number => id !== undefined);

    return {
      nombreMateria: formValue.nombreMateria,
      estado: formValue.estado,
      cursosIds
    };
  }

  private getMateriaName(materia: MateriaModel) {
    return materia.nombreMateria ?? `Materia ${materia.idMateria}`;
  }

  private getCursosLabel(materia: MateriaModel) {
    return materia.cursos?.map(curso => curso.nombreCurso).join(', ') || 'Sin cursos';
  }

  private materiaExists(nombre: string) {
    const normalizedName = nombre.toLowerCase().trim();

    return this.materiasService.materias().some(materia =>
      this.getMateriaName(materia).toLowerCase().trim() === normalizedName
    );
  }

  private getErrorMessage(err: HttpErrorResponse, fallback: string) {
    const message = err.error?.message;

    if (Array.isArray(message)) {
      return message.join(' ');
    }

    if (message) {
      return message;
    }

    return err.status ? `${fallback} Error ${err.status}: ${err.statusText}` : fallback;
  }

  private showSuccess(title: string, text: string) {
    Swal.fire({ icon: 'success', title, text, confirmButtonText: 'Aceptar', confirmButtonColor: '#146b50' });
  }

  private showError(title: string, text: string) {
    Swal.fire({ icon: 'error', title, text, confirmButtonText: 'Aceptar', confirmButtonColor: '#b4232f' });
  }
}
