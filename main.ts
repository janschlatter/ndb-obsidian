import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, requestUrl, request, Vault, FileSystemAdapter, DataAdapter, SuggestModal, WorkspaceLeaf, Workspace} from 'obsidian';

interface ndbSettings {
	searchString: string;
	settingsBool: boolean;
	filelocation: string;
	preferredDB: string;
	deleteEntries: boolean;
	searchIn: string;
	sortOrder: string;
	limit: number;
}

var savedSettings: ndbSettings = {
	searchString: 'Maier, Michael',
	settingsBool: true,
	filelocation: '/Personen/',
	preferredDB: 'ndb',
	deleteEntries: false,
	searchIn: '',
	sortOrder: 'byears_asc',
	limit: 100
}


const vaultaccess = app.vault;
const fileaccess = FileSystemAdapter;
const searchResults = new Array();
var noResults = false;
var id = "";
var isSearching = '*';
const ndbURL = 'http://data.deutsche-biographie.de/beta/solr-open/?q=(r_nam:"'


export default class ndbPlugin extends Plugin {
	settings: ndbSettings;

	async onload() {
		await this.loadSettings();

		// Main Command for Lookup Historical Data
		this.addCommand({
			id: 'ndb-lookup',
			name: 'Start a Query for historical biographical data',
			callback: () => {

				// reset search results
				searchResults.length = 0;

				// Display a modal UI Element to enter the search string and update savedSettings.searchString
				new LookUpModal(this.app, (result) => {
					//check if result is not null, if not null, update saved.Settings.searchstring
					if (result != null) {
						savedSettings.searchString = result;
						this.settings.searchString = result;
						getData();
					} else {
						new Notice('Please enter a name.');
					}
					}).open();

				// Fetch the data from the NDB API.
				// Construct the URL from encodedURL, searchString, isSearching, concatenate "&wt=json&rows=50", and encode it again.
				
				async function getData() {
					var noResults = false;
					const requestURL = encodeURI(ndbURL + isSearching + savedSettings.searchString + isSearching + '") AND (r_ndb:1 OR r_adb:1)&wt=json&rows=100');
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
					//////// PRESORTING THE DATA ////////
					//check each entry of defnam for a match with the search string, push them to a new array and save the index
					var filteredResults = new Array();
					var filteredResultsIndex = new Array();
					for (let i = 0; i < searchResults.length; i++) {
						if (searchResults[i].defnam.includes(savedSettings.searchString)) {
							filteredResults.push(searchResults[i]);
							filteredResultsIndex.push(i);
						}
					}
					//remove the entries from the searchResults array
					for (let i = 0; i < filteredResultsIndex.length; i++) {
						searchResults.splice(filteredResultsIndex[i], 1);
					}
					// console log the filtered results
					console.log(filteredResults);
					// if there are no results, console log "no results"
					if (filteredResults.length == 0) {
						console.log("no results");
					}
					// push the remaining results to the filteredResults array
					for (let i = 0; i < filteredResults.length; i++) {
						searchResults.push(filteredResults[i]);
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

					///////////////
					// DATA CLEANUP
					// check each result for value "n_ko" and "n_le", "a_le"
					for (let i = 0; i < searchResults.length; i++) {
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
  r_ber: string;
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

	//display n_le first 300 characters, if n_le is less than 20 characters or undefined, check if a_le is not undefined, then check if a_le.length is more than 20 chars, if yes, display first 300 characters
	if (Result.n_le.length < 20 || Result.n_le === undefined) {
		if (Result.a_le !== undefined) {
			if (Result.a_le.length > 20) {
				el.createEl("small", { text: Result.a_le.substring(0, 300) + "..." });
			} else {
				el.createEl("small", { text: Result.a_le });
			}
		}
	} else {
		el.createEl("small", { text: Result.n_le.substring(0, 300) + "..." });
	}
  }

  // Save the selected suggestion.
  onChooseSuggestion(Result: results, evt: MouseEvent | KeyboardEvent) {
	async function saveData() {
							// Save the data into a markdown file
							await vaultaccess.create(savedSettings.filelocation + Result.defnam + ".md",
							// Create a new markdown file with the name of the person
							"---\nlicense: CC-BY-NC-ND\n---\n\n" + 
							
							"| Geboren | Gestorben | Wirkungsort | Beruf |\n" + "|:-------|:---------|:------------|:-----|\n" + "| " + Result.byears +" | " + Result.dyears + " | " + " | " + Result.r_ber + "|\n\n" + 						 
									 "\n\n---\n\n ## Wichtiges\n\n" + "## Neue Deutsche Biographie\n\n" + Result.n_le + '## Allgemeine Deutsche Biographie\n\n' + Result.a_le + 
									 "\n\n## Verbindungen\n\n```query\n\"" + Result.defnam + "\" -file:\"" + Result.defnam + "\"" + "\n```"
										);
	}
	saveData();
	new Notice('Saved: ' + Result.defnam);
  }
}
////////////////////////////////
///// Initial Search Modal /////
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
      .setName("Search Term")
      .addText((text) =>
        text.onChange((value) => {
          this.result = value;
		  savedSettings.searchString = value;
		  console.log("Historical Query Search String changed to " + this.result);
        }));

	// add a toggle to show advanced options
	new Setting(contentEl)
	.setName("Advanced Options")
	.addToggle((toggle) => {
		toggle.onChange((value) => {
			if (value) {
				// show advanced options
				new Setting(contentEl)
				.setName("Search in")
				.addDropdown((d) => {
					d.addOption("all", "All Fields");
					d.addOption("defnam", "Name");
					d.addOption("r_flr", "Place of Residence");
					d.addOption("r_ber", "Profession");	
					d.setValue(savedSettings.searchIn);
					d.onChange((v) =>
						savedSettings.searchIn = v);})
				new Setting(contentEl)
				.setName("Sort order")
				.setDesc("By date of birth")
				.addDropdown((d) => {
					d.addOption("asc", "Ascending");
					d.addOption("desc", "Descending");
					d.setValue(savedSettings.sortOrder);
					d.onChange((v) =>
						savedSettings.sortOrder = v);})
				new Setting(contentEl)
				.setName("Limit results to")
				.setDesc("Default 100, reduce if proccessing is slow or on mobile")
				.addText((text) =>
					text.onChange((value) => {
						//convert value to number
						savedSettings.limit = parseInt(value);
						console.log("Historical Query Limit changed to " + value);
					}));
			} else {
				// hide advanced options
				contentEl.removeChild(contentEl.lastChild);
				contentEl.removeChild(contentEl.lastChild);
				contentEl.removeChild(contentEl.lastChild);
				contentEl.removeChild(contentEl.lastChild);
			}
		});
	});




  


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
	plugin: ndbPlugin;

	constructor(app: App, plugin: ndbPlugin) {
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

		// new setting for deleting entries without biography
		new Setting(containerEl)
		.setName('Hide entries without written biography')
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
			addendum.appendText("This plugin is created by Jan Schlatter and is free to use. The data provided by the databases are subject to their respective licenses. The author is not responsible for the content of the databases or possible damage caused by the use of this plugin.");
			hltrDonationDiv.appendChild(addendum);	
}
}



