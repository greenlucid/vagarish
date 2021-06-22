Vagarish is a search engine for Kleros. For the frontend, go to [vagarish-web](https://github.com/greenlucid/vagarish-web)

# Info

Vagarish is a node.js backend server. It periodically checks for changes in Kleros and will use those changes to keep an internal database up to date.
It also provides GraphQL queries to expose the data. They can be fetched from the frontend, [vagarish-web](https://github.com/greenlucid/vagarish-web), or any other app by using the API.

# API

Just query `/api/search?substring=thing` and you'll get a JSON with the search results.
Vagarish is too unstable and early in development, please do not use it until the returned fields are set in stone.
Alternatively, you can use GraphQL by connecting to `/graphql`. Check the source code for the required fields.