// src/app/models/module.model.ts
export interface ModuleModel {
  id?: number;
  name: string;
  description: string;
}

export interface CreateModuleDto {
  name: string;
  description: string;
}

export interface UpdateModuleDto extends Partial<CreateModuleDto> {}
