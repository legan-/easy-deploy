import path from 'path';
import chalk from 'chalk';
import readline from 'readline';

import node_ssh from 'node-ssh';

/* eslint-disable no-console */

const ssh = new node_ssh();

class Deploy {
  constructor(config) {
    this.config = config;

    this.props = {
      projectName: '',
      projectPort: '',
      isServer: null,
      isFirstRun: false,
      localDir: '',
      buildName: 'build.zip'
    };

    this._run();
  }

  _run() {
    Promise.resolve()
      .then(() => this._create())
      .then(rl => this._fetchType(rl))
      .then(rl => this._fetchIteration(rl))
      .then(rl => this._fetchName(rl))
      .then(rl => this._fetchPort(rl))
      .then(rl => this._fetchDirectory(rl))
      .then(rl => rl.close())
      .then(() => this._connect())
      .catch(err => this.error(err));
  }

  _clearLine() {
    readline.moveCursor(process.stdout, 0, -1);
    readline.clearLine(process.stdout, 0);
  }

  static error(message) {
    console.log(`\n${ chalk.red('Error:') } ${ message }\n`);
  }

  _log(message) {
    console.log(message);
  }

  _create() {
    return new Promise(resolve => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      process.stdout.write('\n');
      resolve(rl);
    });
  }

  _fetchType(rl) {
    return new Promise(resolve => {
      const question = 'Are you deploying server or client? ';
      rl.question(`${ question }Server / .Client `, a => {
        const value = a.toString();
        if (value.match(/^s(erver)?$/i)) {
          this.props.isServer = true;
          this._clearLine();
          this._log(`${ question }${ chalk.green('Server') }`);
        } else if (value.match(/^c(lient)?$/i) || value === '') {
          this.props.isServer = false;
          this._clearLine();
          this._log(`${ question }${ chalk.green('Client') }`);
        } else {
          this.error('Wrong answer');
          process.exit(0);
        }
        resolve(rl);
      });
    });
  }

  _fetchIteration(rl) {
    return new Promise(resolve => {
      if (this.props.isServer) {
        const question = 'Is it a first run of this project? ';
        rl.question(`${ question } .Yes / No `, a => {
          const value = a.toString();
          if (value.match(/^y(es)?$/i)) {
            this.props.isFirstRun = true;
            this._clearLine();
            this._log(`${ question }${ chalk.green('Yes') }`);
          } else if (value.match(/^n(o)?$/i) || value === '') {
            this.props.isFirstRun = false;
            this._clearLine();
            this._log(`${ question }${ chalk.green('No') }`);
          } else {
            this.error('Wrong answer');
            process.exit(0);
          }
          resolve(rl);
        });
      } else {
        resolve(rl);
      }
    });
  }

  _fetchName(rl) {
    return new Promise(resolve => {
      const question = 'Name: ';
      rl.question(question, a => {
        const value = a.toString();
        if (value.length) {
          this.props.projectName = value;
          this._clearLine();
          this._log(`${ question }${ chalk.green(value) }`);
        } else {
          this.error('Name can not be empty');
          process.exit(0);
        }
        resolve(rl);
      });
    });
  }

  _fetchPort(rl) {
    return new Promise(resolve => {
      const question = 'Port: ';
      rl.question(question, a => {
        const value = a.toString();
        if (value.length) {
          this.props.projectPort = value;
          this._clearLine();
          this._log(`${ question }${ chalk.green(value) }`);
        } else {
          this.error('Port can not be empty');
          process.exit(0);
        }
        resolve(rl);
      });
    });
  }

  _fetchDirectory(rl) {
    return new Promise(resolve => {
      const dir = path.resolve(__dirname, '..', '../../..');
      const question = 'Project path: ';
      rl.question(`${ question }${ dir }/`, a => {
        const value = path.resolve(dir, a);
        this.props.localDir = value;
        this._clearLine();
        this._log(`${ question }${ chalk.green(value) }`);
        resolve(rl);
      });
    });
  }

  _connect() {
    const { host, port, username, privateKey } = this.config;
    this._log('\nConnecting...\n');
    ssh.connect({
      host,
      port,
      username,
      privateKey
    })
      .then(() => {
        this._log('Connected!\n');

        Promise.resolve()
          .then(() => this._exec(`rm -rf ${ this.props.buildName }`))
          .then(() => this._putBuild())
          .then(() => this._unzip())
          .catch(err => this.error(err));
      });
  }

  _exec(command) {
    const { projectName } = this.props;
    const remoteHomeDir = `/home/${ projectName }`;

    ssh.execCommand(command, { cwd: remoteHomeDir }).then(result => {
      const { stdout, stderr } = result;

      return new Promise((resolve, reject) => {
        if (stderr) {
          reject(`${ chalk.red(command) }:: ${ stderr }`);
        } else if (stdout) {
          this._log(stdout);
          resolve();
        } else {
          this._log(`${ command }: done`);
          resolve();
        }
      });
    });
  }

  _putBuild() {
    const { projectName, localDir, buildName } = this.props;

    const remoteHomeDir = `/home/${ projectName }`;
    const localPath = path.resolve(localDir, 'build', buildName);
    const remotePath = path.resolve(remoteHomeDir, buildName);

    return new Promise((resolve, reject) => {
      ssh.putFile(localPath, remotePath).then(() => {
        this._log(chalk.green('Build uploaded'));
        resolve();
      }, error => {
        reject(error);
      });
    });
  }

  _runApp() {
    const { projectName, projectPort, isFirstRun } = this.props;
    const command = isFirstRun ? `NODE_ENV=production PORT=${ projectPort } pm2 start server/app.js --watch --name ${ projectName }` : `pm2 restart ${ projectName }`;

    return this._exec(command);
  }

  _unzip() {
    const { isServer, buildName } = this.props;
    // const remoteHomeDir = `/home/${ projectName }`;

    if (isServer) {
      return Promise.resolve()
        .then(() => this._exec('rm -rf server'))
        .then(() => this._exec(`unzip ./${ buildName } -d ./server`))
        .then(() => this._runApp());
    } else {
      return Promise.resolve()
        .then(() => this._exec('rm -rf client'))
        .then(() => this._exec(`unzip ./${ buildName } -d ./client`));
    }
  }
}

module.exports = Deploy;