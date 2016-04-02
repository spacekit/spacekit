# SpaceKit

## Install

```bash
$ npm install spacekit -g
```


## Usage

```plain
Usage: spacekit -r home -u rizzle -a 9e67e4d

Options:
  -r, --relay     the name of this relay  [required]
  -u, --username  your spacekit username  [required]
  -a, --apiKey    your spacekit api key  [required]
  -h, --host      the root hostname of the service  [default: "spacekit.io"]
  -s, --service   the service subdomain; uses value with <host> to create
                  the complete hostname (ex: <service>.<host>)  [default: "api"]
  --help          Show help  [boolean]
```


## Config file

If there is a `spacekit.json` file in the directory you run `spacekit` from,
we'll use it to configure the the cli.


## Logs

Log files will be stored in the directory you run `spacekit` from. They're
named `spacekit.log` and will rotate for 3 days (`spacekit.log.0`,
`spacekit.log.1`, etc..).


## License

Apache License, Version 2.0
