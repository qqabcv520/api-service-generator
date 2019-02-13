import { FileGenerateData } from '../core';
import FileGenerator from './FileGenerator';

export interface ClassGenerateData extends FileGenerateData {
    name: string;
}

export default abstract class ClassGenerator extends FileGenerator {

    public abstract getDependencies(data: ClassGenerateData): string[];
}
