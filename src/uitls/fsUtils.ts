import fs from 'fs';
import path from 'path';

export function rmdirsSync(rmPath: string) {
    if (fs.existsSync(rmPath)) {
        const files = fs.readdirSync(rmPath);
        files.forEach((file) => {
            const curPath = path.join(rmPath, file);
            if (fs.statSync(curPath).isDirectory()) {
                rmdirsSync(curPath); // 递归删除文件夹
            } else {
                fs.unlinkSync(curPath); // 删除文件
            }
        });
        fs.rmdirSync(rmPath);
    }
}

export function mkdirsSync(dirPath: string) {
    if (fs.existsSync(dirPath)) {
        return true;
    } else {
        if (mkdirsSync(path.dirname(dirPath))) {
            fs.mkdirSync(dirPath);
            return true;
        }
    }
}

