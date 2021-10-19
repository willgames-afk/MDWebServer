//Loading of modules
const fs = require('fs');             // Files
const express = require('express');   // Server
const showdown = require("showdown"); // Markdown to HTML
const katex = require("katex");       // LATeX to HTML
const path = require("path");         // File Path stuff
const { Template, Page, SnippetTemplate } = require("./templates")

//Setup
const app = express();
const port = 3000;

//error code lookup
const errorMessages = {
	"ENOENT": "Couldn't find this file :( \n(ENOENT)",
	"EACCES": "Sorry, but you don't have access to that! \n(EACCES)",
	"ECONNREFUSED": "Connection Refused. \n(ECONNREFUSED)",
	"ECONNRESET": "Connection reset by peer. :( \n(ECONNRESET)",
	"EMFILE": "Too many open files in system. (Probably due to Will writing bad code) \n(EMFILE)",
	"ENOTFOUND": "DNS lookup failed. \n(ENOTFOUND)",
	"EPERM": "Sorry,but you don't have the permissions to do that. \n(EPERM)",
	"ETIMEDOUT": "Timed Out :( \nMaybe try refresing? \n(ETIMEDOUT)",
}

const public_dir = process.argv[2];
const res_dir = process.argv[3];
const extention_dir = process.argv[4];
const blog_dir = path.join(public_dir, "/blog/")

if (extention_dir) {
	var ext_files = fs.readdirSync(extention_dir);
	console.log(ext_files)
}

function red(string) {
	return `\x1b[31m${string}\x1b[0m`
}
function green(string) {
	return `\x1b[32m${string}\x1b[0m`
}

function loadRes(url) {
	return fs.readFileSync(path.join(res_dir, url))
}

function loadPub(url) {
	return fs.readFileSync(path.join(public_dir, url))
}


const basepage = new Template(path.join(res_dir, "basepage"), true) //Page Template
const postTemplate = new SnippetTemplate(path.join(res_dir, "post"), true);
const index = new Page(path.join(res_dir, "index"), true)

app.use('/', (req, res, next) => {
	if (req.method == "GET") {
		console.log(`${green(req.method)}  ${req.path}`)
	} else if (req.method == "POST") {
		console.log(`${red(req.method)} ${req.path}`)
	} else {
		console.log(`${req.method}  ${req.path}`)
	}
	next();
});//Log all server requests

app.get('/', (req, res) => {
	//console.log("handled by index handler")
	res.type("html");
	if (index.requiresParent) {
		res.send(basepage.fill({}, { content: index.content }));
	} else {
		res.send(index.content);
	}
});

//Resources
app.use('/resources/', (req, res) => {
	//console.log("handled by resources handler")
	res.type(path.extname(req.url)) //Send correct filetype
	res.send(loadRes(req.url));
})

//  blog/
app.get("/blog/", (req, res) => {
	//console.log("handled by blog homepage handler")
	res.send(basepage.fill({ content: "Blog Homepage" }))
})
// blog/imgs/**
app.use("/blog/imgs", (req, res) => {
	//console.log("handled by blog image handler")
	var file;
	try {
		file = loadPub(path.join("blog/imgs", req.path)); //Get the file
	} catch (err) {
		sendErrorMessage(err, res);
		return;
	}
	res.type(path.extname(req.url));
	res.send(file);
})
// blog/** not including /imgs or /
app.use('/blog/', (req, res) => {
	//console.log("Handled by Blog Handler")
	var url = path.join(blog_dir, `${req.url}.md`)
	var rawfile
	try {
		rawfile = fs.readFileSync(url); //Get the file
	} catch (err) {
		sendErrorMessage(err, res);
		return;
	}
	const fileObj = splitFile(rawfile.toString());
	if (!fileObj.timecode) {
		var timecode = addTimecode(url);
	} else {
		//console.log(fileObj.timecode)
		var timecode = fileObj.timecode;
	}

	const latexConverted = preconvertLatex(fileObj.file)    //Convert latex to html

	const converter = new showdown.Converter();             //initialize md converter
	const postContent = converter.makeHtml(latexConverted); //convert markdown to html

	const date = new Date(parseInt(timecode, 10)).toDateString(); //Turn post date into human-readable string

	const page = basepage.fill({
		content: postTemplate.fill({                   //Fill template
			content: postContent,
			title: fileObj.title,
			subtitle: fileObj.subtitle,
			postdate: date
		})
	})

	res.send(page);
})

//Anything in the public folder will be served from the root directory
app.use('/', (req, res) => {
	//console.log("Handled by bulk web handler")
	var file;

	//Attempt to load file
	var name = path.extname(req.url);
	try {
		if (name === "") { //Automatically serve index.html s
			//console.log(`Directory; Serving local index.html (${path.join(public_dir, req.url, "index.html")})`)
			file = fs.readFileSync(path.join(public_dir, req.url, "index.html"));
		} else if (name == ".page") {
			file = basepage.fill({}, new Page(path, true))
		} else {
			file = fs.readFileSync(path.join(public_dir, req.url))
		}

		//If error is thrown, send error page
	} catch (err) {
		if (err.code == "ENOENT" && fs.existsSync(path.join(res_dir, "404page.html"))) {
			res.status(404).sendFile(path.join(res_dir, "404page.html"));
			return
		}

		sendErrorMessage(err, res);
		return;
	}

	//If no errors have been thrown, send file (with correct filetype)
	if (name === "" || name === ".page") {
		res.type("html")
		res.send(file);
	} else {
		res.type("." + path.extname(req.url)) //Send correct filetype
		res.send(file);
	}
})

//Start the app
app.listen(port, () => {
	console.log(`Markdown Web Server listening at http://localhost:${port} \nWith resources at '${res_dir}' and site at '${public_dir}'`);
})


function preconvertLatex(mdstring) {
	var out = mdstring;
	var match;
	while ((match = /```latex\n[^`]+\n```/.exec(out)) !== null) {
		const toConvert = match[0].substring(9, match[0].length - 4)
		const converted = katex.renderToString(toConvert, { displayMode: true });
		out = replace(out, match.index, match.index + match[0].length, '<br>' + converted + '<br>')
	}
	return out;
}


function replace(replacestring, index1, index2, string) {
	var part1 = replacestring.substring(0, index1);
	var part2 = replacestring.substring(index2)
	return part1 + string + part2;
}

function splitFile(poststring) { //Splits a md post into metadata and file
	var index = poststring.indexOf('\n');
	const title = poststring.substring(0, index);
	index++;
	var newIndex = poststring.indexOf('\n', index);
	const subtitle = poststring.substring(index, newIndex);
	newIndex++
	index = poststring.indexOf('\n', newIndex);
	const timecode = poststring.substring(newIndex, index);
	const file = poststring.substring(index);
	return {
		title: title,
		subtitle: subtitle,
		timecode: timecode,
		file: file
	}
}

/**
 * Inserts a string into a specific place in a file
 * 
 * @param {String} filePath Path to the file to insert data into
 * @param {Number} position Position to begin inserting
 * @param {String} string String to insert
 * @param {String | Buffer} [fileContents] If the file to be modified has already been loaded, you can pass it in here and avoid having to load it again.
 */

function addTimecode(filePath) { //Inserts a string into a specific place in a file
	var code = Date.now();
	var fileData = fs.readFileSync(filePath).toString();
	var insertIndex = fileData.indexOf("\n", fileData.indexOf("\n") + 1) + 1; //Get the position after the second newline (So the 3rd line)

	var fileEnd = fileData.substring(insertIndex);

	var file = fs.openSync(filePath, 'r+');
	var newFileEnd = code + "\n" + fileEnd;
	fs.writeSync(file, newFileEnd, insertIndex); //Replaces the end of the file with the timecode, followed by the rest of the file.
	fs.close(file);
	return code;
}

function sendErrorMessage(err, res) {
	console.log("Failed, " + err.code)
	res.type("html");
	res.send("<h1>Error</h1>" + NLtoBR(errorMessages[err.code]));
}

function NLtoBR(string) {
	return string.replace(/(?:\r\n|\r|\n)/g, "<br>")
}

function getPosts() {

	const _dir = fs.readdirSync(blog_dir, { withFileTypes: true });
	var dir = [];
	for (var i = 0; i < _dir.length; i++) {
		if (_dir[i].name[0] != ".") {
			if (!_dir[i].isDirectory()) {
				dir.push({ name: _dir[i].name, });
			}
		}
	}
	return dir;

}
console.log(JSON.stringify(getPosts()));