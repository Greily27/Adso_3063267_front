// import { Module } from "../../../core/services/auth";
import { ModuleModel } from "../../modules/models/module.model";
// import { ModuleModel } from "../../modules/models/module.model";

export interface RoleModel {
  id?: number;
  name: string;
  description: string;
  modules: ModuleModel[]; // Relación Many-to-Many
}

export interface CreateRoleDto {
  name: string;
  description: string;
  moduleIds: number[]; 
}