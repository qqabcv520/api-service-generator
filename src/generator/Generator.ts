import { GenerateData } from '../core';

export interface Generator {
    generate(data: GenerateData): void;

    getTemplateModel(data: GenerateData): any;
}
