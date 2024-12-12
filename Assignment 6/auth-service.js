const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Mongoose Schema Definition
const userSchema = new mongoose.Schema({
    userName: { type: String, required: true },
    password: { type: String, required: true },
    email: { type: String, required: true },
    loginHistory: [
        {
            dateTime: { type: Date, required: true },
            userAgent: { type: String, required: true }
        }
    ]
});

let userData = {
    userName: "",      // String: Username chosen by the user
    email: "",         // String: User's email address
    password: "",      // String: User's password (to be hashed)
};

let User;

// Initialize the database connection
module.exports.initialize = function () {
    return new Promise(function (resolve, reject) {
        let db = mongoose.createConnection("mongodb+srv://fchowdhury21:xSz8ft6y5eteEmYY@cluster0.klwd2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0");

        db.on('error', (err) => {
            reject(err); // reject the promise with the provided error
        });
        db.once('open', () => {
            User = db.model("users", userSchema);
            resolve();
        });
    });
};

// Register a new user
module.exports.registerUser = function (userData) {
    return new Promise((resolve, reject) => {
        if (userData.password !== userData.password2) {
            reject("Passwords do not match");
            return;
        }

        bcrypt.hash(userData.password, 10)
            .then(hash => {
                userData.password = hash;
                delete userData.password2; // Remove this to prevent accidental storage

                let newUser = new User(userData);
                newUser.save()
                    .then(() => {
                        resolve({ successMessage: "User created" });
                    })
                    .catch(err => {
                        if (err.code === 11000) {
                            reject("User Name already taken");
                        } else {
                            reject(`There was an error creating the user: ${err}`);
                        }
                    });
            })
            .catch(err => {
                reject("There was an error encrypting the password: " + err);
            });
    });
};

// Check if the user's credentials are valid
module.exports.checkUser = function (userData) {
    return new Promise((resolve, reject) => {
        User.find({ userName: userData.userName }).then((users) => {
            if (users.length === 0) {
                return reject("Unable to find user: " + userData.userName);
            }

            bcrypt.compare(userData.password, users[0].password).then((result) => {
                if (!result) {
                    return reject("Incorrect Password for user: " + userData.userName);
                }

                users[0].loginHistory.push({
                    dateTime: new Date().toString(),
                    userAgent: userData.userAgent
                });

                users[0].save((err) => {
                    if (err) {
                        return reject("There was an error verifying the user: " + err);
                    }
                    resolve(users[0]);
                });
            }).catch((err) => {
                reject("Error comparing password: " + err);
            });
        }).catch((err) => {
            reject("Unable to find user: " + userData.userName);
        });
    });
};
