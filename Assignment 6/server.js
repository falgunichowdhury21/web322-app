// https://github.com/falgunichowdhury21/web322-app

const express = require('express');
const ejsLayouts = require('express-ejs-layouts');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const methodOverride = require('method-override');
const storeService = require('./store-service');
const authData = require('./auth-service'); 
const clientSessions = require('client-sessions');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;


// Cloudinary Configuration
cloudinary.config({
  cloud_name: 'dcewrum1y',
  api_key: '347466237954442',
  api_secret: 'rFlJrt5USFJ3ALSL7JLGq9e-7LQ',
  secure: true,
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(ejsLayouts);
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');

// Utility to format date
function formatDate(dateObj) {
  let year = dateObj.getFullYear();
  let month = (dateObj.getMonth() + 1).toString();
  let day = dateObj.getDate().toString();
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Active route middleware
app.use((req, res, next) => {
  let route = req.path.substring(1);
  app.locals.activeRoute = '/' + (isNaN(route.split('/')[1]) ? route.replace(/\/(?!.*)/, '') : route.replace(/\/(.*)/, ''));
  app.locals.viewingCategory = req.query.category || null;
  app.locals.formatDate = formatDate;
  next();
});

app.use(clientSessions({
  cookieName: 'session', // the cookie name
  secret: 'abc123$#0019', // secret key for encryption
  duration: 2 * 60 * 60 * 1000, // session duration (2 hours)
  activeDuration: 1000 * 60 * 5 // session renewal if active within 5 minutes
}));

// Make the session globally available to all views
app.use((req, res, next) => {
  res.locals.session = req.session; // Make session object accessible in all views
  next();
});

// Initialize storeService and authData
storeService.initialize()
  .then(() => {
    console.log("Database synchronized successfully");
  })
  .catch((err) => {
    console.error("Unable to sync the database:", err);
  });

authData.initialize()
  .then(() => {
    console.log("Authentication system initialized successfully");
  })
  .catch((err) => {
    console.error("Unable to initialize auth service:", err);
  });

// Routes
app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/shop');
  } else {
    res.render('about', { session: req.session });
  }
});

app.get('/about', (req, res) => {
  res.render('about', { title: 'About Us' });
});

// Shop route
app.get('/shop', async (req, res) => {
  try {
    const items = await storeService.getAllItems();
    const categories = await storeService.getCategories();

    console.log('Items:', items);
    console.log('Categories:', categories);

    res.render('shop', { items, categories });
  } catch (error) {
    console.error('Error fetching data for shop:', error);
    res.render('shop', { items: [], categories: [], message: 'Error fetching data' });
  }
});


// Items
app.get('/items', async (req, res) => {
  try {
    const items = await storeService.getAllItems();
    res.render('items', { items });
  } catch (error) {
    res.render('items', { items: [], message: error });
  }
});

app.get('/items/add', async (req, res) => {
  try {
    const categories = await storeService.getCategories();
    res.render('addPost', { categories });
  } catch (error) {
    res.render('addPost', { categories: [] });
  }
});

app.post('/items/add', multer().single('featureImage'), async (req, res) => {
  try {
    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream((error, result) => {
          if (result) resolve(result);
          else reject(error);
        });
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
      req.body.featureImage = uploadResult.url;
    }
    await storeService.addItem(req.body);
    res.redirect('/items');
  } catch (error) {
    res.status(500).send('Unable to add item.');
  }
});

app.post('/items/delete/:id', async (req, res) => {
  try {
    await storeService.deletePostById(req.params.id);
    res.redirect('/items');
  } catch (error) {
    res.status(500).send('Unable to delete item.');
  }
});

app.get('/categories', async (req, res) => {
  try {
    const categories = await storeService.getCategories();
    res.render('categories', { categories, message: null }); // Include the `message` key with a default value
  } catch (error) {
    res.render('categories', { categories: [], message: error });
  }
});



app.get('/categories/add', (req, res) => {
  res.render('addCategory');
});

app.post('/categories/add', async (req, res) => {
  try {
    await storeService.addCategory(req.body);
    res.redirect('/categories');
  } catch (error) {
    res.status(500).send('Unable to add category.');
  }
});

app.post('/categories/delete/:id', async (req, res) => {
  try {
    await storeService.deleteCategoryById(req.params.id);
    res.redirect('/categories');
  } catch (error) {
    res.status(500).send('Unable to delete category.');
  }
});


app.use((req, res, next) => {
    res.locals.session = req.session;  // This makes the session object available in all views
    next();
  });
  
function ensureLogin(req, res, next) {
  if (!req.session.user) {
      res.redirect("/login");
  } else {
      next(); // user is logged in, proceed to the next middleware or route handler
  }
}

// Apply ensureLogin middleware to routes requiring user to be logged in
app.use('/items', ensureLogin);
app.use('/categories', ensureLogin);
app.use('/category', ensureLogin);
app.use('/post', ensureLogin);

// Specific routes that require authentication

// View items
app.get('/items', async (req, res) => {
  try {
    const items = await storeService.getAllItems();
    res.render('items', { items });
  } catch (error) {
    res.render('items', { items: [], message: error });
  }
});

// Add item
app.get('/items/add', async (req, res) => {
  try {
    const categories = await storeService.getCategories();
    res.render('addPost', { categories });
  } catch (error) {
    res.render('addPost', { categories: [] });
  }
});

// Post item (ensure user is logged in before allowing them to post)
app.post('/items/add', multer().single('featureImage'), ensureLogin, async (req, res) => {
  try {
    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream((error, result) => {
          if (result) resolve(result);
          else reject(error);
        });
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
      req.body.featureImage = uploadResult.url;
    }
    await storeService.addItem(req.body);
    res.redirect('/items');
  } catch (error) {
    res.status(500).send('Unable to add item.');
  }
});

// Delete item
app.post('/items/delete/:id', ensureLogin, async (req, res) => {
  try {
    await storeService.deletePostById(req.params.id);
    res.redirect('/items');
  } catch (error) {
    res.status(500).send('Unable to delete item.');
  }
});

// View categories
app.get('/categories', async (req, res) => {
  try {
    const categories = await storeService.getCategories();
    res.render('categories', { categories, message: null });
  } catch (error) {
    res.render('categories', { categories: [], message: error });
  }
});

// Add category
app.get('/categories/add', ensureLogin, (req, res) => {
  res.render('addCategory');
});

app.post('/categories/add', ensureLogin, async (req, res) => {
  try {
    await storeService.addCategory(req.body);
    res.redirect('/categories');
  } catch (error) {
    res.status(500).send('Unable to add category.');
  }
});

// Delete category
app.post('/categories/delete/:id', ensureLogin, async (req, res) => {
  try {
    await storeService.deleteCategoryById(req.params.id);
    res.redirect('/categories');
  } catch (error) {
    res.status(500).send('Unable to delete category.');
  }
});

app.post("/login", (req, res) => {
  // Authenticate the user (e.g., check credentials in the database)
  const user = authenticate(req.body.username, req.body.password);
  
  if (user) {
      req.session.user = {
          userName: user.username,
          email: user.email,
          isAdmin: user.isAdmin
      };
      res.redirect("/dashboard"); // redirect to a secure page
  } else {
      res.render("login", { error: "Invalid username or password" });
  }
});

app.get("/logout", (req, res) => {
  req.session.reset(); // clears the session
  res.redirect("/login");
});

// Routes

// GET /login: renders the login view
app.get('/login', (req, res) => {
  res.render('login', { errorMessage: null, userName: null });
});

// GET /register: renders the register view

app.get('/register', (req, res) => {
  // Make sure userName is passed to the template
  res.render('register', { 
    errorMessage: null, 
    successMessage: null, 
    userName: '',  // Pass userName as an empty string
    email: ''      // Pass email as an empty string
  });
});


// POST /register: handle user registration
app.post('/register', (req, res) => {
  const { userName, email, password } = req.body;

  // Add validation or processing for registration
  if (userName && email && password) {
    // Proceed with the registration process
    res.redirect('/success');  // After successful registration
  } else {
    // If there's an error or validation issue
    res.render('register', {
      errorMessage: "Please fill all the fields.",  // Show error message
      successMessage: null,
      userName: userName,  // Pass userName back to the template
      email: email  // Pass email back to the template
    });
  }
});



// POST /login: handle user login
app.post('/login', async (req, res) => {
  req.body.userAgent = req.get('User-Agent'); // Add User-Agent to the request body
  try {
    const user = await authData.CheckUser(req.body); // Check user credentials
    req.session.user = {
      userName: user.userName,
      email: user.email,
      loginHistory: user.loginHistory,
    };
    res.redirect('/items'); // Redirect to items view
  } catch (err) {
    res.render('login', { errorMessage: err, userName: req.body.userName });
  }
});

// GET /logout: clear the session and redirect to the home page
app.get('/logout', (req, res) => {
  req.session.reset(); // Reset the session
  res.redirect('/'); // Redirect to home page
});

// GET /userHistory: display the user's login history (protected by ensureLogin middleware)
app.get('/userHistory', ensureLogin, (req, res) => {
  if (req.session.user) {
      res.render('userHistory');
  } else {
      res.redirect('/login'); // or render an error page
  }
});

// Server setup
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
