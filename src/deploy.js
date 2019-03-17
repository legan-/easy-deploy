import path from 'path';
import chalk from 'chalk';
import readline from 'readline';

import node_ssh from 'node-ssh';

const ssh = new node_ssh();

class Deploy {
  constructor(config) {

    this.props = Object.assign({
      projectName: '',
      projectPort: '',
      isServer: null,
      isFirstRun: null,
      localDir: '',
      clientBuildName: 'build-client.zip',
      serverBuildName: 'build-server.zip'
    }, config);

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
      .then(rl => this._connect(rl))
      .catch(err => this._error(err));
  }

  _clearLine() {
    readline.moveCursor(process.stdout, 0, -1);
    readline.clearLine(process.stdout, 0);
  }

  static error(message) {
    /* eslint-disable-next-line no-console */
    console.log(`\n${ chalk.red('Error:') } ${ message }\n`);
  }

  _error(message) {
    Deploy.error(message);
  }

  _log(message) {
    /* eslint-disable-next-line no-console */
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
      const { isServer } = this.props;
      const defaultValue = isServer === null ? '' : isServer ? 'Server' : 'Client';
      const defaultValueToShow = defaultValue.length ? chalk.grey(defaultValue) : '[C/s]';

      rl.question(`${ question }${ defaultValueToShow } `, a => {
        const value = a.toString() || defaultValue || 'c';

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
        const { isFirstRun } = this.props;
        const defaultValue = isFirstRun === null ? '' : isFirstRun ? 'Yes' : 'No';
        const defaultValueToShow = defaultValue.length ? chalk.grey(defaultValue) : '[N/y]';

        rl.question(`${ question }${ defaultValueToShow } `, a => {
          const value = a.toString() || defaultValue || 'n';

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
      const { projectName } = this.props;
      const defaultValue = projectName.length ? `${ chalk.grey(projectName) } ` : '';

      rl.question(`${ question }${ defaultValue }`, a => {
        const value = a.toString() || projectName;
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
      const { projectPort } = this.props;
      const defaultValue = projectPort.length ? `${ chalk.grey(projectPort) } ` : '';

      rl.question(`${ question }${ defaultValue }`, a => {
        const value = a.toString() || projectPort;
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
      const { localDir } = this.props;
      const defaultValue = localDir.length ? chalk.grey(localDir) : `${ dir }/`;

      rl.question(`${ question }${ defaultValue }`, a => {
        const value = localDir || path.resolve(dir, a);
        this.props.localDir = value;
        this._clearLine();
        this._log(`${ question }${ chalk.green(value) }`);
        resolve(rl);
      });
    });
  }

  _connect(rl) {
    const {
      host,
      port,
      username,
      password,
      clientBuildName,
      serverBuildName,
      isServer
    } = this.props;

    this._log('\nConnecting...\n');

    const connect = password => {
      ssh
        .connect({
          host,
          port,
          username,
          password
        })
        .then(() => {
          const fileName = isServer ? serverBuildName : clientBuildName;

          this._log(chalk.green('Connected\n'));

          Promise.resolve()
            .then(() => this._remove(fileName))
            .then(() => this._putBuild())
            .then(() => this._unpack())
            .catch(err => this._error(err));
        })
        .catch(error => {
          this._log(chalk.red('Error\n'));
          this._log(error);
        });
    };

    if (password === undefined) {
      rl.stdoutMuted = true;
      const question = `Please enter a password for ${ username }@${ host }:${ port } `;
      rl.question(`${ question }`, answer => {
        rl.close();
        connect(answer);
      });
    } else {
      connect(password);
    }

    rl._writeToOutput = stringToWrite => {
      if (rl.stdoutMuted)
        rl.output.write('');
      else
        rl.output.write(stringToWrite);
    };
  }

  _putBuild() {
    const {
      projectName,
      localDir,
      clientBuildName,
      serverBuildName,
      isServer
    } = this.props;

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
    const {
      projectName
    } = this.props;

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
      .catch(error => this._log(error));
  }

  _exec(command) {
    const {
      projectName
    } = this.props;

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
    const {
      isServer,
      isFirstRun,
      projectName,
      projectPort
    } = this.props;

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