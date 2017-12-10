#### firebase.config.js example
```js
module.exports = {
  apiKey: 'firebase API key',
  authDomain: "projet-id.firebaseapp.com",
  databaseURL: 'https://projet-id.firebaseio.com/',
  projectId: "projet-id",
  storageBucket: "projet-id.appspot.com",
  messagingSenderId: "see firebase config",
};
```
#### secrets.js example
```js
module.exports = {
  passwordSalt: 'just some salt',
  tokenSecret: 'super secret',
  databaseCredentials: {
    email: 'john.doe@gmail.com',
    password: '123456',
  },
};
```

#### Firebase rules
```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null",
    "profiles": {
      ".indexOn": ["searchOptimized/firstName", "searchOptimized/lastName"]
    }
  }
}
```