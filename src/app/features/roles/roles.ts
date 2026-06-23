import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import Swal from 'sweetalert2';
import { CustomTable, TableColumn } from '../../shared/components/custom-table/custom-table';
import { Auth } from '../../core/services/auth';
import { ModuleModel } from '../modules/models/module.model';
import { FormComponent } from './components/form-component/form-component';
import { CreateRoleDto, RoleModel } from './models/roles.model';
import { RolesService } from './services/roles-service';

@Component({
  selector: 'app-roles',
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    CustomTable
  ],
  templateUrl: './roles.html',
  styleUrl: './roles.scss',
})
export class Roles {
  private rolesService = inject(RolesService);
  private authService = inject(Auth);

  public columns: TableColumn[] = [
    { label: 'ID', key: 'id' },
    { label: 'Nombre', key: 'name' },
    { label: 'Descripcion', key: 'description' },
    { label: 'Módulos', key: 'modulesList' }
  ];

  public rolesForTable = computed(() => {
    return this.rolesService.roles().map(role => ({
      ...role,
      modulesList: role.modules.map(m => m.name).join(', ') || 'Sin módulos'
    }));
  });

  constructor(private dialog: MatDialog) {}

  openDialog() {
    const dialogRef = this.dialog.open(FormComponent, { width: '550px' });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const roleDto: CreateRoleDto = {
          name: result.name,
          description: result.description,
          moduleIds: result.modules.map((module: ModuleModel) => module.id)
        };

        this.rolesService.createRole(roleDto).subscribe({
          next: (response: RoleModel) => this.showSuccess('Rol creado', `${response.name} se guardo correctamente.`),
          error: (err: HttpErrorResponse) => {
            console.error('Error al guardar', err);
            this.showError('Error al guardar', this.getErrorMessage(err, 'No se pudo crear el rol.'));
          }
        });
      }
    });
  }

  handleEdit(role: RoleModel) {
    const dialogRef = this.dialog.open(FormComponent, {
      width: '550px',
      data: role
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && role.id) {
        const roleDto: CreateRoleDto = {
          name: result.name,
          description: result.description,
          moduleIds: result.modules.map((module: ModuleModel) => module.id)
        };

        this.rolesService.updateRole(role.id, roleDto).subscribe({
          next: response => {
            this.authService.updateLocalUserRole(response);
            this.showSuccess('Rol actualizado', `${response.name} se actualizó correctamente.`);
          },
          error: (err: HttpErrorResponse) => {
            console.error('Error al actualizar', err);
            this.showError('Error al actualizar', this.getErrorMessage(err, 'No se pudo actualizar el rol.'));
          }
        });
      }
    });
  }

  async handleDelete(role: RoleModel) {
    if (role.id === undefined) return;

    const result = await Swal.fire({
      icon: 'warning',
      title: 'Eliminar rol',
      text: `Estas seguro de eliminar ${role.name}?`,
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#b4232f'
    });

    if (!result.isConfirmed) return;

    this.rolesService.deleteRole(role.id).subscribe({
      next: () => this.showSuccess('Rol eliminado', 'El rol se eliminó correctamente.'),
      error: (err: HttpErrorResponse) => {
        console.error('Error al eliminar', err);
        this.showError('Error al eliminar', this.getErrorMessage(err, 'No se pudo eliminar el rol.'));
      }
    });
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
