import { Octokit } from '@octokit/rest';
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';

export default class GitHubProvider {
  constructor(branch = null) {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
    this.ownerGitHub = process.env.GITHUB_OWNER;
    this.repoGitHub = process.env.GITHUB_REPO;
    this.setBranch(branch);
  }

  setBranch(branch) {
    this.branchGitHub = branch || process.env.GITHUB_BRANCH || 'main';
  }

  async downloadRepo(destination, acceptableExt = []) {
    if (!fs.existsSync(destination)) throw new Error(`Directory ${destination} does not exist.`);

    let { data: сontents } = await this.octokit.rest.repos.getContent({
      owner: this.ownerGitHub,
      repo: this.repoGitHub,
      path: '',
      ref: this.branchGitHub,
    });

    const downloadFiles = async (items, dir, dirGitHub = '') => {
      for (const item of items) {
        const fsPath = path.join(dir, item.name);
        
        if (item.type === 'file') {
          if (acceptableExt.length === 0 || acceptableExt.includes(path.extname(item.name))) {
            const response = await axios.get(item.download_url, { responseType: 'arraybuffer' });
            await fs.outputFile(fsPath, response.data);
          }
        } else if (item.type === 'dir') {
          await fs.ensureDir(fsPath);
          let curentDirGitHub = dirGitHub ? `${dirGitHub}/${item.name}` : item.name;
          const { data: subDirContents } = await this.octokit.rest.repos.getContent({
            owner: this.ownerGitHub,
            repo: this.repoGitHub,
            path: curentDirGitHub,
            ref: this.branchGitHub,
          });
          await downloadFiles(subDirContents, fsPath, curentDirGitHub);
        }
      }
    };

    await downloadFiles(сontents, destination);
  };

  async downloadFile(destination, pathFile) {
    if (!fs.existsSync(destination)) throw new Error(`Directory ${destination} does not exist.`);

    let { data: dataFile } = await this.octokit.rest.repos.getContent({
      owner: this.ownerGitHub,
      repo: this.repoGitHub,
      path: pathFile,
      ref: this.branchGitHub,
    });

    if (typeof dataFile === 'object' && !Array.isArray(dataFile) && dataFile.type === 'file') {
      const response = await axios.get(dataFile.download_url, { responseType: 'arraybuffer' });
      const fsPath = path.join(destination, dataFile.path);
      await fs.outputFile(fsPath, response.data);
    }
    else {
      console.error(`Полученный объект ${pathFile} не является файлом репозитория: ${dataFile}`);
    }
  }
};
