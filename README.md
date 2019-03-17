Run: easy-deploy [ --config path/to/config/file ]

Default path for config file is /deploy.config.js 

Config file must contain object of:
- host
- port
- username

optional:
- password
- projectName
- projectPort
- isServer
- isFirstRun
- localDir

Module will ask a password before connection. [!] Also, you can place it in your config file (unsecure).

If you don't have optional params in the config file the package will ask you to enter necessary data.

Hints:

The package can be tested in a real project by linking:

In a package dir: yarn link

In a real project: yarn link "@legan/deploy"

To reverse this process, simply use yarn unlink or yarn unlink "@legan/deploy"
