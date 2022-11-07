import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, requestUrl, request, Vault, FileSystemAdapter, DataAdapter, SuggestModal, WorkspaceLeaf, Workspace} from 'obsidian';

// Remember to rename these classes and interfaces!

// import Papa from 'papaparse';
import * as Papa  from 'papaparse.min.js';

interface MyPluginSettings {
	searchString: string;
	settingsBool: boolean;
	filelocation: string;
	preferredDB: string;
	deleteEntries: boolean;
}

var savedSettings: MyPluginSettings = {
	searchString: 'Maier, Michael',
	settingsBool: true,
	filelocation: '/Personen/',
	preferredDB: 'ndb',
	deleteEntries: false
}


const vaultaccess = app.vault;
const fileaccess = FileSystemAdapter;
const searchResults = new Array();
var noResults = false;
var id = "";
var isSearching = '*';
const ndbURL = 'http://data.deutsche-biographie.de/beta/solr-open/?q=r_nam:'


export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// Main Command for Lookup Historical Data
		this.addCommand({
			id: 'ndb-lookup',
			name: 'Start a Query for historical biographical data',
			callback: () => {

				// reset search results
				searchResults.length = 0;

				// Fetch the data from the NDB API.
				// Construct the URL from encodedURL, searchString, isSearching, concatenate "&wt=json&rows=50", and encode it again.
				const requestURL = encodeURI(ndbURL + isSearching + savedSettings.searchString + isSearching + " AND (r_ndb:1 OR r_adb:1)&wt=json&rows=100");

				async function getData() {
					var noResults = false;
					const response = await requestUrl({
						url: requestURL,
						method: 'GET',
						contentType: 'JSON'
					});
					// console log the url
					console.log(requestURL);
					//loop through the json data and create a new array
					console.log(response);
					const data = response.json.response.docs;
					for (let i = 0; i < data.length; i++) {
						searchResults.push(data[i]);
					}

					// check if data is undefined and if so, stop the function, close the modal
					if (searchResults.length == 0) {
						noResults = true;
						// display a notice that no results were found
						new Notice("No results found for " + savedSettings.searchString);
						// stop the function
						return;
					}

					//sort the JSON data by value of byears ascending
					searchResults.sort(function (a, b) {
						return a.byears - b.byears;
					});

					// remove entries where neither r_ndb nor r_adb are true from JSON data
					for (let i = 0; i < searchResults.length; i++) {
						if (searchResults[i].r_ndb == false) {
							searchResults.splice(i, 1);
							console.log("Cleaned up Entry");
						}
					}



					//////////////////////////////////////////////////////////////////////////////////////////
					// DATA CLEANUP
					// check each result for value "n_ko" and "n_le", "a_le"
					for (let i = 0; i < searchResults.length; i++) {
							// this has created errors, for now just for reference
						// if (searchResults[i].n_ko !== undefined) {
						// 	searchResults[i].n_ko = searchResults[i].n_ko.replace(/(?:\r\n|\r|\n)/g, ' ');
						// }	
						// if (searchResults[i].n_le !== undefined) {
						// 	searchResults[i].n_le = searchResults[i].n_le.replace(/(?:\r\n|\r|\n)/g, ' ');
						// }
						// if (searchResults[i].a_le !=== undefined) {
						// 	searchResults[i].a_le = searchResults[i].n_le.replace(/(?:\r\n|\r|\n)/g, ' ');
						// }
						// check each result for value "byears" and "dyears", if empty, set to "N.A."
						if (searchResults[i].byears === undefined) {
							searchResults[i].byears = "N.A.";
						}	
						if (searchResults[i].dyears === undefined) {
							searchResults[i].dyears = "N.A.";
						}
						// check each result for value "n_le" and "a_le", if empty, set to "N.A."
						if (searchResults[i].n_le === undefined) {
							searchResults[i].n_le = "N.A.";
						}
						if (searchResults[i].a_le === undefined) {
							searchResults[i].a_le = "N.A.";
						}
					}

					// Create a new Modal with the search results
					new searchResultModal(app).open();



				}

				// Display a modal UI Element to enter the search string and update savedSettings.searchString
				new LookUpModal(this.app, (result) => {
					//check if result is not null, if not null, update saved.Settings.searchstring
					if (result != null) {
						savedSettings.searchString = result;
						this.saveSettings();
						getData();
					} else {
						new Notice('Please enter a name.');
					}
				  }).open();

				  
			
			}
			
		});




		// Add the settings tab entry for this plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, savedSettings, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Handle the Search Results; Create a new Modal with the search results and display them. Then, save the selected one.

interface results {
  defnam: string;
  r_flr: string;
  n_le: string;
  a_le: string;
  byears: string;
  dyears: string;
  id: string;
}

export class searchResultModal extends SuggestModal<results> {
  // Returns all available suggestions.
  getSuggestions(query: string): results[] {
    return searchResults.filter((Result) =>
      Result.defnam.toLowerCase().includes(query.toLowerCase())
    );
  }

  // Display each suggestion in a list item.
  // TODO: Stylize this a bit cleaner
  renderSuggestion(Result: results, el: HTMLElement) {
    el.createEl("div", { text: Result.defnam });
    el.createEl("small", { text: Result.r_flr + "\n"});

	//display n_le first 300 characters, if n_le is less than 20 characters, display a_le first 300 characters
	if (Result.n_le.length < 20) {
		el.createEl("small", { text: Result.a_le.substring(0, 300) + "..." });
	} else {
		el.createEl("small", { text: Result.n_le.substring(0, 300) + "..." });
	}
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Check if Result.id starts with "sfz", if yes, then substring the id and save it as a new variable
// Then, search for the id in the csv file "relations.csv" and check if the id is in the file
// If yes, then console.log the id and the corresponding value of the id
// If no, then console.log the id and "no relation found"

// checkRelations(Result: results, evt: MouseEvent | KeyboardEvent) {
// 	if (Result.id.startsWith("sfz")) {
// 		let id = Result.id.substring(3);
// 	}

// 	//papaparse "ndbrel.csv"
// 	Papa.parse("ndbrel.csv", {
// 		download: true,
// 		complete: function(results) {
// 			console.log(results);
// 		}
// 	});
// }

  // Save the selected suggestion.
  onChooseSuggestion(Result: results, evt: MouseEvent | KeyboardEvent) {
	async function saveData() {
							// Save the data into a markdown file
							await vaultaccess.create(savedSettings.filelocation + Result.defnam + ".md",
							// Create a new markdown file with the name of the person
							"---\nlicense: CC-BY-NC-ND\n---\n\n" + 
							
							"| Geboren | Gestorben | Wirkungsort | Beruf |\n" + "|:-------|:---------|:------------|:-----|\n" + "| " + Result.byears +" | " + Result.dyears + " | " + " | " + " |\n\n" + 						 
									 "\n\n---\n\n ## Wichtiges\n\n" + "## Deutsche Biographie-Dump\n\n" + Result.n_le + 
									 "\n\n## Verbindungen\n\n```query\n\"" + Result.defnam + "\" -file:\"" + Result.defnam + "\"" + "\n```"
										);
	}
	saveData();
	new Notice('Saved: ' + Result.defnam);
  }
}

class LookUpModal extends Modal {
  result: string;
  onSubmit: (result: string) => void;

  constructor(app: App, onSubmit: (result: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl("h1", { text: "Start Historical Query" });

    new Setting(contentEl)
	.setName("Select Database").setDesc("Where do you want to search?").addDropdown((d) => {
		d.addOption("ndb", "Neue Deutsche Biographie");
		d.addOption("bitlib", "British Library");
		d.addOption("met", "Metropolitan Museum of Art");
		d.setValue(savedSettings.preferredDB);
		d.onChange((v) => 
		  savedSettings.preferredDB = v);})



    new Setting(contentEl)
      .setName("Lastname, Firstname")
      .addText((text) =>
        text.onChange((value) => {
          this.result = value;
		  console.log("Historical Query Search String changed to " + this.result);
        }));

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Search")
          .setCta()
          .onClick(() => {
            this.close();
            this.onSubmit(this.result);
          }));

	
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Historical Query'});

		new Setting(containerEl)
		.setName("Preferred Database").setDesc("Which Database should be set as default?").addDropdown((d) => {
			d.addOption("ndb", "Neue Deutsche Biographie");
			d.addOption("bitlib", "British Library");
			d.addOption("met", "Metropolitan Museum of Art");
			d.setValue(savedSettings.preferredDB);
			d.onChange((v) => 
			  savedSettings.preferredDB = v);})

		new Setting(containerEl)
			.setName('Name for Testing Purposes')
			.setDesc('Needs to be Surname, Firstname')
			.addText(text => text
				.setPlaceholder('Enter a name')
				.setValue(this.plugin.settings.searchString)
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.searchString = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Saving Location')
			.setDesc('For created biographical files')
			.addText(text => text
				.setPlaceholder('dir/subdir/')
				.setValue(this.plugin.settings.filelocation)
				.onChange(async (value) => {
					console.log('file location changed to: ' + value);
					this.plugin.settings.filelocation = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
		.setName('Test Bool')
		.setDesc('On or off?')
		.addToggle((text) => text
			.setValue(this.plugin.settings.settingsBool)
			.onChange(async (value) => {
				console.log("TestBool switched to: " + value);
				this.plugin.settings.settingsBool = value;
				await this.plugin.saveSettings();
			}));

		// new setting for deleting entries without biography
		new Setting(containerEl)
		.setName('Delete entries without biography')
		.setDesc('For Deutsche Biographie only')
		.addToggle((text) => text
			.setValue(this.plugin.settings.deleteEntries)
			.onChange(async (value) => {
				console.log("Delete entries without biography switched to: " + value);
				this.plugin.settings.deleteEntries = value;
				await this.plugin.saveSettings();
			}));


			const hltrDonationDiv = containerEl.createEl("div", {
				cls: "hltrDonationSection",
			});
			const addendum = createEl("p");
			addendum.appendText("This plugin is free to use. The data provided by the databases are subject to their respective licenses.");
			hltrDonationDiv.appendChild(addendum);	
}
}



