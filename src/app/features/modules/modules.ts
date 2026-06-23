import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CustomTable, TableColumn } from '../../shared/components/custom-table/custom-table';
import { ModuleModel } from './models/module.model';
import { ModulesForm } from './components/modules-form/modules-form';
import { ModulesService } from './services/modules';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-modules',
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    CustomTable
  ],
  templateUrl: './modules.html',
  styleUrl: './modules.scss',
})
export class Modules {
  private moduleService = inject(ModulesService);
  public modules = this.moduleService.modules;
  public errorMessage = '';

  public columns: TableColumn[] = [
    { label: 'ID', key: 'id' },
    { label: 'Nombre', key: 'name' },
    { label: 'Descripcion', key: 'description' }
  ];

  constructor(private dialog: MatDialog) {}

  ngOnInit() {
    this.moduleService.loadModules();
  }

  openDialog() {
    const dialogRef = this.dialog.open(ModulesForm, { width: '550px' });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.errorMessage = '';

        if (this.moduleExists(result.name)) {
          this.errorMessage = `Ya existe un módulo llamado "${result.name}".`;
          this.showError('Modulo duplicado', this.errorMessage);
          return;
        }

        this.moduleService.createModule(result).subscribe({
          next: (response: ModuleModel) => this.showSuccess('Modulo creado', `${response.name} se guardo correctamente.`),
          error: (err: HttpErrorResponse) => {
            console.error('Error al guardar', err);
            this.errorMessage = this.getErrorMessage(err, 'No se pudo crear el módulo.');
            this.showError('Error al guardar', this.errorMessage);
          }
        });
      }
    });
  }

  handleEdit(module: ModuleModel) {
    const dialogRef = this.dialog.open(ModulesForm, {
      width: '550px',
      data: module
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && module.id) {
        this.errorMessage = '';

        this.moduleService.updateModule(module.id, result).subscribe({
          next: response => this.showSuccess('Módulo actualizado', `${response.name} se actualizó correctamente.`),
          error: (err: HttpErrorResponse) => {
            console.error('Error al actualizar', err);
            this.errorMessage = this.getErrorMessage(err, 'No se pudo actualizar el módulo.');
            this.showError('Error al actualizar', this.errorMessage);
          }
        });
      }
    });
  }

  async handleDelete(module: ModuleModel) {
    if (module.id !== undefined) {
      const result = await Swal.fire({
        icon: 'warning',
        title: 'Eliminar módulo',
        text: `Estas seguro de eliminar a ${module.name}?`,
        showCancelButton: true,
        confirmButtonText: 'Si, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#b4232f'
      });

      if (!result.isConfirmed) return;
      this.errorMessage = '';

      this.moduleService.delete(module.id).subscribe({
        next: () => this.showSuccess('Módulo eliminado', 'El módulo se eliminó correctamente.'),
        error: (err: HttpErrorResponse) => {
          console.error('Error al eliminar', err);
          this.errorMessage = this.getErrorMessage(err, 'No se pudo eliminar el módulo.');
          this.showError('Error al eliminar', this.errorMessage);
        }
      });
    }
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

  private moduleExists(name: string) {
    const normalizedName = name.toLowerCase().trim();

    return this.modules().some(module =>
      module.name.toLowerCase().trim() === normalizedName
    );
  }

  private showSuccess(title: string, text: string) {
    Swal.fire({ icon: 'success', title, text, confirmButtonText: 'Aceptar', confirmButtonColor: '#146b50' });
  }

  private showError(title: string, text: string) {
    Swal.fire({ icon: 'error', title, text, confirmButtonText: 'Aceptar', confirmButtonColor: '#b4232f' });
  }
}
