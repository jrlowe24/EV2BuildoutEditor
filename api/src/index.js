// server/index.js

const express = require("express");
const axios = require('axios'); // Import the axios library
const cors = require("cors"); // Import the cors package
const cheerio = require('cheerio');
const PORT = process.env.PORT || 3001;
const app = express();

app.use(cors()); // Use the cors middleware


app.get("/api", (req, res) => {
    res.json({ message: "Hello from server!" });
});

app.get("/", (req, res) => {
    res.json({ message: "Home" });
});

app.get("/api/armtemplate", async (req, res) => {
    const resource = req.query.resource;

    if (!resource) {
        res.status(400).send('Missing resource parameter');
        return;
    }


    const url = `https://learn.microsoft.com/en-us/azure/templates/${resource}?pivots=deployment-language-arm-template`;
    try {
        const response = await axios.get(url); // Make the HTTP GET request
        const htmlContent = response.data; // HTML content from the response

        // Parse the HTML content with Cheerio
        const $ = cheerio.load(htmlContent);

        // Find the code element with class 'lang-json'
        const codeElement = $('code.lang-json').first();

        if (codeElement.length > 0) {
            // Extract the JSON-like content
            const codeContent = codeElement.text();
      
            // Parse the JSON-like content
            try {
              const parsedObject = JSON.parse(codeContent);
              console.log(`Arm Template Type: ${parsedObject.type}`);
              
              res.json(parsedObject); // Send the parsed JSON-like object as a response
              //)
            } catch (error) {
              console.error('Error parsing JSON-like content:', error);
              res.status(500).send('Error parsing JSON-like content');
            }
          } else {
            console.log('Code element not found');
            res.status(404).send('Code element not found');
          }
    
      } catch (error) {
        res.status(500).send(`Error fetching URL, ${error}`);
      }
});
  
app.listen(PORT, () => {
console.log(`Server listening on ${PORT}`);
});


// response = requests.get(url)
// html_content = response.text

// # Parse the HTML content
// soup = BeautifulSoup(html_content, 'html.parser')

// # Find all code elements containing JSON-like content

// # code_elements = soup.find_all('code')
// code_element = soup.find('code', class_='lang-json')

// if code_element:
//     # Extract the data-author-content attribute value
//     code_content = code_element.get_text()

//     # Unescape HTML entities
//     code_content = html.unescape(code_content)
//     print(code_content)
    
//     python_object = json.loads(code_content)

//     print(python_object["type"])
