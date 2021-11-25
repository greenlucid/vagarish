# Vagarish

Vagarish is a search engine for Kleros. For the frontend, go to [vagarish-web](https://github.com/greenlucid/vagarish-web).

Try it out at [vagarish.forer.es](https://vagarish.forer.es)

## Info

Vagarish is a node.js backend server. It periodically checks for changes in Kleros and will use those changes to keep an internal database up to date.
It also provides GraphQL queries to expose the data. They can be fetched from the frontend, [vagarish-web](https://github.com/greenlucid/vagarish-web), or any other app by using the API.

## API

- For text, just query `/api/search?substring=thing` and you'll get a JSON with the search results. Sadly, it's case sensitive and it will look for the substring itself.
- `/api/search?id=1000` to fetch a dispute with all its evidence
- `/api/search?courtId=23` to fetch evidence from a court
- `/api/search?by=0x001FE2CdBEeB0743679E958C0861Dd8788B28b19` to fetch all evidence by an address
- [This hasn't been tested] You can combine queries with &: `/api/search?courtId=23&substring=address`, this will fetch all evidence containing `address` in court 23.

Complex queries may break because the search logic really is spaghetti code. Add an issue if you notice something odd.

Alternatively, you can use GraphQL by connecting to `/graphql`. Check the source code for the required fields.

## How to deploy your own Vagarish

Vagarish serves the vagarish-web frontend by default. Just focus on setting a single page, and the app will take care of serving the frontend and doing server work.

### Initial setup

Get an Ubuntu server. Can be cheap. Even 1GB servers can keep up.

`apt install npm`

`git clone https://github.com/greenlucid/vagarish`

`git clone https://github.com/greenlucid/vagarish-web`

`cd vagarish-web`

`npm i`

`cd ../vagarish`

`cp .env.template .env`

Fill your env variables. 

`npm i`

`npm run build:full`

This last one can take like 20 minutes if it's a small server. It could even crash due to insufficient memory. If you got 1GB RAM or less, follow [this guide](https://www.digitalocean.com/community/tutorials/how-to-add-swap-space-on-ubuntu-16-04) to add swap to the server. 1GB should be enough. Put a swappiness of 10, and you'll find it somehow faster than before.

### MongoDB

[Full guide](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/)

Get key `wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -`

Add mongogb apt server `echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list`

Reload apt `sudo apt-get update` 

Install `sudo apt-get install -y mongodb-org`

Start it `sudo systemctl start mongod`

Set it to start on reboot: `sudo systemctl enable mongod`

### Server stuff

- [Get nginx](https://nginx.org/en/docs/beginners_guide.html), set it up. Point your domain to the DNS. [This is a good guide](https://landchad.net/nginx), and you can follow it for the other steps. [This is a guide that incorporates Node servers](https://snapshooter.com/blog/how-to-run-nodejs-server-with-nginx), you will need it to set up a reverse proxy. It might be possible to set the reverse proxy in sites-available directly.
- Then test that it actually works, by running it with `npm start` and checking your domain.
- Get pm2. [Guide](https://pm2.keymetrics.io/)
- Get lets encrypt, set it up. [Guide](https://landchad.net/certbot). If node + let's encrypt gives you problems, you can alternatively create a dumb html website, certify it, and then get your real page.
- Put a cron job so that it renews the certificate automatically, or you'll forget

### Seed the database

Currently Vagarish has to, incredibly, be updated up by hand! I haven't made an script to do this automatically.
The initial seeding takes way longer than future updates.

`cd vagarish`

`mkdir files/events files/ipfs`
`echo "[]" > files/events/subcourtIds.json`

`npm run init`

First time can take around, 1 hour or 2.
Next times it's around 15 minutes.
You will only run `npm run init` next time.
The website is accessible while it's being seeded or updated.
If you want your instance to keep up, just come by every week or so.

TODO: make a script you can use with cron, to stop pm2, run `npm run init`, stop it and run pm2 again.