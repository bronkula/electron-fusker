const { api } = window;

const updateSelectedFolderInput = (folderPath) => {
    const selectedFolderInput = document.querySelector('.folder input');
    selectedFolderInput.value = folderPath;
};

document.addEventListener('DOMContentLoaded', () => {
    const urlListInput = document.querySelector('.url-list textarea');
    const folderButton = document.querySelector('.folder button');
    const downloadButton = document.querySelector('.download');

    let selectedFolderPath = '';

    folderButton.addEventListener('click', async () => {
        window.api.send('choose-folder');
    });

    window.api.receive('folder-selected', (folderPath) => {
        selectedFolderPath = folderPath;
        updateSelectedFolderInput(selectedFolderPath);
    });

    downloadButton.addEventListener('click', async () => {
        const urls = urlListInput.value.split(/\,\s*/);
        for (const url of urls) {
            if (url.trim() !== '') {
                const result = await window.api.invoke('download', { folderPath: selectedFolderPath, url: url.trim() });
                console.log("result", result)
            }
        }
        // urlListInput.value = '';
    });
});