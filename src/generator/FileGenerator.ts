import { Generator } from './Generator';
import { mkdirsSync } from '../uitls/fsUtils';
import fs from 'fs';
import Mustache from 'mustache';
import * as path from 'path';
import { FileGenerateData } from '../core';



export default abstract class FileGenerator implements Generator {

    abstract getTemplateModel(data: FileGenerateData): {filename: string; [key: string]: any};

    generate(data: FileGenerateData): void {
        const templateModel = this.getTemplateModel(data);
        const content = Mustache.render(require(path.join(process.cwd(), data.templatePath)), templateModel);
        this.writeFile(data.targetPath, templateModel.filename, content);
    }

    writeFile(targetPath: string, filename: string, content: string): void {
        mkdirsSync(targetPath);
        fs.writeFileSync(path.join(targetPath, filename), content);
    }
}
