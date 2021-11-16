const { json } = require("express");
const fs = require("fs");
const p = require("path")


class AlmostHTMLFile {
	constructor(type, path, onload = false) {
		var ext = p.extname(path)
		if (ext.length == 0) {
			path = p.join(p.dirname(path), p.basename(path) + type);
		} else if (ext != type) {
			console.warn(`Expected Extension ${type}, got ${ext} instead.`)
		}
		this.onload = onload;
		
		if (typeof onload == "boolean" && onload) {
			//If onload == true, it means load sync
			this.file = fs.readFileSync(path, { encoding: "utf8" });
			this._getHead();
		} else {
			fs.readFile(path, { encoding: "utf8" }, function (err, data)  {
				if (err) {
					console.error(err);
				} else {
					this.file = data;
					this._getHead();
					this.onload();
				}
			}.bind(this))
		}
	}
	_getHead() {
		var res = this.file.match(/<head>([\w\W]*)<\/head>/)
		if (res.groups) {
			this.head = res.groups[0];
		}
		this.content = this.file.replace(/<head>([\w\W]*)<\/head>/,"");
	}
}
class Template extends AlmostHTMLFile {
	constructor(path, onload = false) {
		super(".htmlt", path, onload);
	}
	fill(params,optParams) {
		var out = this.file;
		var head = this.head;
		for (var p in params) {
			var cp = params[p]
			if (typeof cp == "object") {
				if (cp.head) {
					head += cp.head
					cp = cp.content;
				}
			}
			//console.log(p)

			var newOut = out.replace(new RegExp(`\\$${p}\\$`,"g"), cp);
			if (newOut === out) {
				//Didn't replace anything!
				throw "Template parameter does not exist!"
			}
			out = newOut
		}
		for (var p in optParams) {
			var cp = optParams[p]
			//console.log("Filling parameter '" + p + "' with " + cp)
			if (typeof cp == "object") {
				//console.log("Parameter is Object")
				if (cp.head) {
					head += cp.head
				}
				if (cp.content) {
					cp = cp.content;
				}
			}
			out = out.replace(new RegExp(`\\$${p}\\$`,"g"), cp);
		}
		//console.log(out)
		return out;
	}
}

class Snippet extends AlmostHTMLFile {
	constructor(path, onload = false) {
		super(".htmls",path, onload);
	}
}

class SnippetTemplate extends AlmostHTMLFile {
	constructor(path, onload = false) {
		super(".htmlst", path, onload);
	}
	fill(params,optParams) {
		var out = this.file;
		var head = this.head;
		for (var p in params) {
			var cp = params[p]
			if (typeof cp == "object") {
				if (cp.head) {
					head += cp.head
					cp = cp.content;
				}
			}

			var newOut = out.replace(new RegExp(`\\$${p}\\$`,"g"), cp);
			if (newOut === out) {
				//Didn't replace anything!
				throw "Template parameter does not exist!"
			}
			out = newOut
		}
		for (var p in optParams) {
			var cp = optParams[p]
			if (typeof cp == "object") {
				if (cp.head) {
					head += cp.head
					cp = cp.content;
				}
			}
			out = out.replace(new RegExp(`\\$${p}\\$`,"g"), cp);
		}
		return out;
	}
}

class Page {
	constructor(path, onload = false) {
		var ext = p.extname(path)
		//console.log(ext)
		if (ext.length > 0 && !(ext == ".page" || ext == ".html")) {
			console.warn(`Expected Extension ${type}, got ${ext} instead.`)
		} else if (ext.length == 0) {
			if (fs.existsSync(p.join(p.dirname(path),p.basename(path) + ".page"))) {
				path = p.join(p.dirname(path),p.basename(path) + ".page")
			} else {
				path = p.join(p.dirname(path),p.basename(path) + ".html")
			}
		}
		if (ext == "html") {
			this.requiresParent = false;
		} else {
			this.requiresParent = true;
		}

		function getHead() {
			var res = this.file.match(/<head>([\w\W]*)<\/head>/)
			if (res.groups) {
				this.head = res.groups[0];
			}
			this.content = this.file.replace(/<head>([\w\W]*)<\/head>/,"");
		}
		getHead = getHead.bind(this);
		
		if (typeof onload == "boolean" && onload) {
			//If onload == true, it means load sync
			this.file = fs.readFileSync(path, { encoding: "utf8" });
			
			if (this.requiresParent) {
				getHead.bind(this)();
			} else {
				this.content = this.file;
			}
		} else {
			fs.readFile(path, { encoding: "utf8" }, function (err, data) {
				if (err) {
					console.error(err);
				} else {
					this.file = data;
					if (this.requiresParent) {
						getHead.bind(this)();
					} else {
						this.content = this.file
					}
					onload();
				}
			}.bind(this))
		}
		//console.log("CONTENT: "+ this.content)
	}
}

module.exports = {Template, Snippet, Page, SnippetTemplate}