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
      clientBuildName: 'build-client.zip',
      serverBuildName: 'build-server.zip'
    };

    this._run();
  }

  _run() {

    Promise.resolve()
      .then(() => this._create())
      .then(rl => this._fetchType(rl))
      .then(rl => this._fetchIteration(rl))
      .then(rl => this._fetchName(rl))
      .then(rl => this.props.isServer ? this._fetchPort(rl) : rl)
      .then(rl => this._fetchDirectory(rl))
      .then(rl => rl.close())
      .then(() => this._connect())
      .catch(err => this._error(err));
  }

  _clearLine() {
    readline.moveCursor(process.stdout, 0, -1);
    readline.clearLine(process.stdout, 0);
  }

  static error(message) {
    console.log(`\n${ chalk.red('Error:') } ${ message }\n`);
  }

  _error(message) {
    Deploy.error(message);
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
      const question = 'Are you deploying a client or a server? - ';
      rl.question(`${ question }[C/s] `, a => {
        const value = a.toString() || 'c';
        if (value.match(/^s(erver)?$/i)) {
          this.props.isServer = true;
          this._clearLine();
          this._log(`${ question }${ chalk.green('Server') }`);
        } else if (value.match(/^c(lient)?$/i) || value === '') {
          this.props.isServer = false;
          this._clearLine();
          this._log(`${ question }${ chalk.green('Client') }`);
        } else {
          this._error('Wrong answer');
          process.exit(0);
        }
        resolve(rl);
      });
    });
  }

  _fetchIteration(rl) {
    return new Promise(resolve => {
      if (this.props.isServer) {
        const question = 'Is it a first run of this project? - ';
        rl.question(`${ question }[N/y] `, a => {
          const value = a.toString() || 'n';
          if (value.match(/^y(es)?$/i)) {
            this.props.isFirstRun = true;
            this._clearLine();
            this._log(`${ question }${ chalk.green('Yes') }`);
          } else if (value.match(/^n(o)?$/i) || value === '') {
            this.props.isFirstRun = false;
            this._clearLine();
            this._log(`${ question }${ chalk.green('No') }`);
          } else {
            this._error('Wrong answer');
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
          this._error('Name can not be empty');
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
          this._error('Port can not be empty');
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
    const { clientBuildName, serverBuildName, isServer } = this.props;
    this._log('\nConnecting...\n');
    ssh.connect({
      host,
      port,
      username,
      privateKey
    })
      .then(() => {
        const fileName = isServer ? serverBuildName : clientBuildName;

        this._log(chalk.green('Connected\n'));

        Promise.resolve()
          .then(() => this._remove(fileName))
          .then(() => this._putBuild())
          .then(() => this._unpack())
          .catch(err => this._error(err));
      });
  }

  _putBuild() {
    const { projectName, localDir, clientBuildName, serverBuildName, isServer } = this.props;

    const fileName = isServer ? serverBuildName : clientBuildName;
    const remoteHomeDir = `/home/${ projectName }`;
    const localPath = path.resolve(localDir, 'build', fileName);
    const remotePath = path.resolve(remoteHomeDir, fileName);

    return new Promise((resolve, reject) => {
      ssh.putFile(localPath, remotePath).then(() => {
        this._log(chalk.green('Build uploaded\n'));
        resolve();
      }, error => {
        reject(error);
      });
    });
  }

  _remove(name) {
    const { projectName } = this.props;
    const remoteHomeDir = `/home/${ projectName }`;
    const command = `rm -rf ${ name }`;

    ssh.execCommand(command, { cwd: remoteHomeDir })
      .then(result => {
        const { stderr } = result;

        return new Promise((resolve, reject) => {
          if (stderr) {
            reject(`${ chalk.red(command) }:: ${ stderr }`);
          } else {
            this._log(chalk.green(`${ name } removed`));
            resolve();
          }
        });
      })
      .catch(err => console.log('err', err));
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

  _unpack() {
    const { isServer, isFirstRun, projectName, projectPort } = this.props;
    this._log('Running bash command...');
    // unzip script must be included in ~/.ssh_functions (root)
    let command = '';

    if (isServer) {
      const port = isFirstRun ? ` ${ projectPort }` : '';
      command = `source ~/.ssh_functions; unzip-server ${ projectName }${ port }`;
    } else {
      command = `source ~/.ssh_functions; unzip-client ${ projectName }`;
    }

    ssh.execCommand(command).then(({ stdout, stderr }) => {
      if (stderr) {
        this._log(`${ chalk.red(command) }:: ${ stderr }`);
      }
      if (stdout) {
        this._log(stdout);
      } else {
        this._log(`${ command }: done`);
      }
      process.exit(0);
    });
  }
}

module.exports = Deploy;