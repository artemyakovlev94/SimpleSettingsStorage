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

  async downloadFile(destination, pathGitHub = null) {
    if (!fs.existsSync(destination)) throw new Error(`Directory ${destination} does not exist.`);

    pathGitHub = pathGitHub ?? "";

    const { data: сontents } = await this.octokit.rest.repos.getContent({
      owner: this.ownerGitHub,
      repo: this.repoGitHub,
      path: pathGitHub,
      ref: this.branchGitHub,
    });

    const downloadFiles = async (items, dir, dirGitHub = '') => {
      for (const item of items) {
        const fsPath = path.join(dir, item.name);
        
        if (item.type === 'file') {
          const response = await axios.get(item.download_url, { responseType: 'arraybuffer' });
          await fs.outputFile(fsPath, response.data);
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

    await downloadFiles(сontents, destination, pathGitHub);
  }
};
