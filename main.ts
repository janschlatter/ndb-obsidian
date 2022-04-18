import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, requestUrl, request, Vault, FileSystemAdapter, DataAdapter, SuggestModal} from 'obsidian';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	searchString: string;
	settingsBool: boolean;
	filelocation: string;
	preferredDB: string;
}

const savedSettings: MyPluginSettings = {
	searchString: 'Maier, Michael',
	settingsBool: true,
	filelocation: '/Personen/',
	preferredDB: 'ndb'
}


const vaultaccess = app.vault;
const fileaccess = FileSystemAdapter;
const searchResults = new Array();


export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// Main Command for Lookup Historical Data
		this.addCommand({
			id: 'ndb-lookup',
			name: 'Start a Query for historical biographical data',
			callback: () => {

				// Fetch the data from the NDB API.
				async function getData() {
					const response = await requestUrl({
						url: "http://data.deutsche-biographie.de/beta/solr-open/?q=defnam:%22" + savedSettings.searchString + "%22&wt=json",
						method: 'GET',
						contentType: 'JSON'
					});
					//loop through the json data and create a new array
					const data = response.json.response.docs;
					for (let i = 0; i < data.length; i++) {
						searchResults.push(data[i]);
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
    el.createEl("small", { text: Result.r_flr });
	el.createEl("small", { text: Result.n_le });
  }

  // Save the selected suggestion.
  onChooseSuggestion(Result: results, evt: MouseEvent | KeyboardEvent) {
    new Notice(`Selected ${Result.defnam}`);
	async function saveData() {
							// Save the data into a markdown file
							await vaultaccess.create(savedSettings.filelocation + savedSettings.searchString + ".md",
							// Create a new markdown file with the name of the person
									 "# " + Result.defnam + "\n\n" + Result.r_flr + "\n\n" + Result.n_le.replace(/(?:\r\n|\r|\n)/g, ' ')
		
										);
										console.log("Henlo");
	}
	saveData();
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
	.setName("Preferred Database").setDesc("Which Database should be set as default?").addDropdown((d) => {
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
          this.result = value
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

			const hltrDonationDiv = containerEl.createEl("div", {
				cls: "hltrDonationSection",
			});
			const addendum = createEl("p");
			addendum.appendText("This plugin is free to use. The data provided by the databases are subject to their respective licenses.");
			hltrDonationDiv.appendChild(addendum);	
}
}



