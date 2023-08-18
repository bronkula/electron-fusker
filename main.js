const { app, BrowserWindow, ipcMain, dialog, net } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { promisify } = require('util');

const asyncDialogShowOpenDialog = promisify(dialog.showOpenDialog);
const asyncFsWriteFile = promisify(fs.writeFile);

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, './src/preload.js')
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

ipcMain.on('save-url', (event, url) => {
    const savePath = dialog.showSaveDialogSync(mainWindow, {
        defaultPath: 'saved_urls.txt'
    });

    if (savePath) {
        fs.appendFileSync(savePath, url + '\n');
    }
});

ipcMain.on('choose-folder', (event) => {
    const result = dialog.showOpenDialogSync(mainWindow, {
        properties: ['openDirectory']
    });

    if (result?.length > 0) {
        event.reply('folder-selected', result[0]);
    }
});

const fuskerDigitRegex = /\[(\d*)-(\d+)\]/;
const fuskerLowercaseRegex = /\[([a-z]*)-([a-z]+)\]/;
const fuskerUppercaseRegex = /\[([A-Z]*)-([A-Z]+)\]/;
const digits = " 123456789";
const lowercase = " abcdefghijklmnopqrstuvwxyz";
const uppercase = " ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const runDigitFusker = (fuskmatch) => {
    const [fullMatch, start, end] = fuskmatch;
    const matches = [];

    const padding = start.length || 1;
    if (start > end) throw new Error('Start number must be less than end number');
    const numberStart = start !== "" ? parseInt(start) : 0;
    const numberEnd = parseInt(end);
    const numberFormat = new Intl.NumberFormat('en-US', { minimumIntegerDigits: padding });
    
    for (let i = numberStart; i <= numberEnd; i++) {
        const number = numberFormat.format(i);
        const newUrl = fuskmatch.input.replace(fullMatch, number);

        if (fuskerDigitRegex.test(newUrl)) {
            matches = [...matches, ...parseFuskerUrl(newUrl)];
        } else {
            matches.push(newUrl);
        }
    }
    return matches;
}
const runLowercaseFusker = (fuskmatch) => {
    const [fullMatch, start, end] = fuskmatch;
    const matches = [];

    const letterStart = start !== "" ? start : " ";
    const letterEnd = end;

    if (lowercase.indexOf(letterStart) > lowercase.indexOf(letterEnd))
        throw new Error('Start number must be less than end number');
    
    for(let i = lowercase.indexOf(letterStart); i <= lowercase.indexOf(letterEnd); i++) {
        const letter = lowercase[i] === " " ? "" : lowercase[i];
        const newUrl = fuskmatch.input.replace(fullMatch, letter);
        
        if (fuskerLowercaseRegex.test(newUrl)) {
            matches = [...matches, ...parseFuskerUrl(newUrl)];
        } else {
            matches.push(newUrl);
        }
    }
    return matches;
}
const runUppercaseFusker = (fuskmatch) => {
    const [fullMatch, start, end] = fuskmatch;
    const matches = [];

    const letterStart = start !== "" ? start : " ";
    const letterEnd = end;

    if (uppercase.indexOf(letterStart) > uppercase.indexOf(letterEnd))
        throw new Error('Start number must be less than end number');
        
    for(let i = uppercase.indexOf(letterStart); i <= uppercase.indexOf(letterEnd); i++) {
        const letter = uppercase[i] === " " ? "" : uppercase[i];
        const newUrl = fuskmatch.input.replace(fullMatch, letter);

        if (fuskerUppercaseRegex.test(newUrl)) {
            matches = [...matches, ...parseFuskerUrl(newUrl)];
        } else {
            matches.push(newUrl);
        }
    }
    return matches;
}
    


const parseFuskerUrl = (url) => {
    matches = [
        [fuskerDigitRegex.exec(url), runDigitFusker],
        [fuskerLowercaseRegex.exec(url), runLowercaseFusker],
        [fuskerUppercaseRegex.exec(url), runUppercaseFusker]
    ].reduce((r, [fuskmatch, fusker]) => {
        return [...r, ...fuskmatch ? fusker(fuskmatch): []];
    }, []);
    
    return matches;
};


// const downloadPromisesFromUrlList = (folderPath, urlList) => {
//     return urlList.reduce((acc, url) => {
//         return acc.then(() => {
//             request.get(url).pipe(fs.createWriteStream(path.join(folderPath, path.basename(url))))
//             return asyncFsWriteFile(path.join(folderPath, path.basename(url)), url)
//             .catch((error) => {
//                 console.error(error);
//             });
//         });

//     }, Promise.resolve());
// };

// Create a function that receives a list of urls and reduces it to a single promise chain
// Each promise in the chain will download a single url
// Each link will have its own catch handler to prevent the chain from breaking
const downloadPromisesFromUrlList = (folderPath, urlList) => {
    return urlList.reduce((acc, url) => {
        return acc.then(async (previousresult) => {
            const result = await downloadPromiseFromUrl(folderPath, url)
                .catch((error) => {
                    console.error(error);
                    return error;
                })
            return [...previousresult, result];
        });
    }, Promise.resolve([]));
};

// Create a function that receives a url and creates a promise that will download the file and return it's local path
const downloadPromiseFromUrl = (folderPath, url) => {
    return new Promise((resolve, reject) => {
        const fileName = path.basename(url);
        const filePath = path.join(folderPath, fileName);

        const protocol = url.startsWith('https') ? https : http;

        protocol.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Request failed with status code ${response.statusCode}`));
                return;
            }

            const fileStream = fs.createWriteStream(filePath);

            response.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                resolve(filePath);
            });

            fileStream.on('error', (error) => {
                reject(error);
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
};

ipcMain.handle('download', async (event, data) => {
    // console.log({event,data})
    const { folderPath, url } = data;
    const results = parseFuskerUrl(url);
    console.log({results})

    downloadPromisesFromUrlList(folderPath, results).then(() => {
        console.log('Downloads completed');
    });



    // const fileName = path.basename(url);
    // const filePath = path.join(folderPath, fileName);
    // const request = net.request(url);

    // request.on('response', (response) => {
    //     const fileStream = fs.createWriteStream(filePath);
    //     response.pipe(fileStream);

    //     fileStream.on('finish', () => {
    //         fileStream.close();
    //     });

    //     fileStream.on('error', (error) => {
    //         console.error(error);
    //     });
    // });

    // request.on('error', (error) => {
    //     console.error(error);
    // });

    // request.end();
});