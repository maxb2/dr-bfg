# dungeon-revealer [![Build Status](https://travis-ci.org/apclary/dungeon-revealer.svg?branch=master)](https://travis-ci.org/apclary/dungeon-revealer)


A web app for tabletop gaming to allow the game master to reveal areas of the game map to players.

## What the DM Sees

![alt text](https://user-images.githubusercontent.com/9096667/60119974-6b491500-9745-11e9-9e13-6c52b20b605d.png "DM's View")

You can protect the DM area by setting a password.

## What the players see

![alt text](https://user-images.githubusercontent.com/9096667/60120496-86685480-9746-11e9-903d-87b23369451c.png "Player's view")

## Getting Started

### Getting the app

The easiest way to use dungeon-revealer is to download the app from the [releases](https://github.com/apclary/dungeon-revealer/releases) page here on github. There is also a [docker image](https://hub.docker.com/r/apclary/dungeon-revealer) that is kept up to date with the releases in this repository.

#### Prebuilt app

**Download the app for your system from the [releases page](https://github.com/apclary/dungeon-revealer/releases).**
We provide builds for Windows, Linux, and OSX.

Running from the command prompt will present connection information and some debugging.
Optionally, you may set a password for the dungeon master page by setting the environmental variable `DM_PASSWORD` when starting the app. e.g. for linux `DM_PASSWORD='password' ./dungeon-revealer-linux`


##### Linux
Before you run the application for the first time, open a terminal in the same directory as the app and run the command:
```
chmod +x dungeon-revealer-linux
```
Then you can run the app directly in the terminal.
```
./dungeon-revealer-linux
```

##### OSX
Before you run the application for the first time, open a terminal in the same directory as the app and run the command:
```
chmod +x dungeon-revealer-macos
```
Then you can run the app directly in the terminal.
```
./dungeon-revealer-macos
```

##### Windows
Either double click the app or open a command prompt in the same directory as the app and run from there.
Then go to `localhost:3000` in your browser and point your players to `<YOUR_IPADDRESS>:3000`.

##### Docker

To create a docker instance, run the following:

```
docker pull apclary/dungeon-revealer:latest
docker run -e DM_PASSWORD=<password> -p <PORT>:3000 -v <DATA_DIR>:/usr/src/app/data -d apclary/dungeon-revealer:latest
```

- Replace `<password>` with your chosen DM password
- Replace `<PORT>` with your preferred port.
- `<DATA_DIR>` is the directory on the host filesystem in which you want to store the maps and settings. `<DATA_DIR>` **must be an absolute path.** One way to achieve this in linux is to navigate to the directory you want in the terminal and then use `$PWD/data` as `<DATA_DIR>`.


In your browser, go to `<YOUR_IPADDRESS>:<PORT>`.

### Using the app
There are two modes of usage of this app. One for the dungeon master and one for the players.


#### Dungeon Master

To use dungeon-revealer, the game master and the players must be on the same local network (usually a wifi network). The game master will start the server (see Installation), navigate to the server's URL in a web browser, click on the Dungeon Master link, and then enter a password if it is set. At this point, they will be prompted to upload an image file of the map to share with the other players. The other players will navigate to the server using their own browsers (laptop, tablet, or phone) and will remain at the home page. The connection information is displayed in command prompt for convenience.

To clear areas of the map, click and draw on the map. You can switch the brush mode by clicking the "Reveal" or "Shroud" button. Alternatively, you can select an area to clear or shroud by clicking the "Select Area" button. Whenever the game master clears some of the fog of war from the map and it is ready to share with the players, they will click "Send" and the revealed areas of the map will appear in the players' browsers. What appears as a shadow to the DM will appear as pure blackness to players, thus only revealing the cleared sections of the map to them. The "Mark" button will display a circle for a period of time to indicate a point of interest.

To switch to a different map, click "Change map", and then select one of the maps you have already uploaded and click "Load". The "LIVE" indicator in the lower right indicates if the map currently on the dungeon master page is being presented on the player page. the "Stop Sharing" button will blank the player page in preparation for a new map to be loaded.



#### Players

Navigate to the server using a web browser and wait at the home page. (The connection information is displayed in command prompt for convenience.) When the dungeon master is ready, they will push a map to your webpage. You will see either a black screen or a partially covered image. You can zoom in/out and pan the map. On a long click you will place a "point of interest" on the map that will show as a red circle.

## Contributing

See the [CONTRIBUTING.md](CONTRIBUTING.md).
