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

export function copyFile(srcPath: string, tarPath: string, cb?: Function) {
    const rs = fs.createReadStream(srcPath);
    rs.on('error', function (err) {
        if (err) {
            console.log('read error', srcPath);
        }
        if (cb) {
            cb(err);
        }
    });
    const ws = fs.createWriteStream(tarPath);
    ws.on('error', function (err) {
        if (err) {
            console.log('write error', tarPath);
        }
        if (cb) {
            cb(err);
        }
    });
    ws.on('close', function (ex: any) {
        if (cb) {
            cb(ex);
        }
    });
    rs.pipe(ws);
}

export function copyFolder(srcDir: string, tarDir: string, cb?: Function) {

    fs.readdir(srcDir, function (err, files) {
        if (files == null) {
            throw new Error('文件夹不存在');
        }
        // 为空时直接回调
        if (files.length === 0) {
            if (cb) {
                cb();
            }
            return;
        }
        let count = 0;
        if (err) {
            checkEnd();
            return;
        }
        files.forEach(function (file) {
            const srcPath = path.join(srcDir, file);
            const tarPath = path.join(tarDir, file);

            fs.stat(srcPath, function (_, stats) {
                if (stats.isDirectory()) {
                    console.log('mkdir', tarPath);
                    fs.mkdir(tarPath, function () {
                        copyFolder(srcPath, tarPath, checkEnd);
                    });
                } else {
                    copyFile(srcPath, tarPath, checkEnd);
                }
            });
        });

        function checkEnd() {
            ++count;
            if (count === files.length && cb) {
                cb();
            }
        }
    });
}


