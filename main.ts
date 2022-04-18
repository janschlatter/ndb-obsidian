import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, requestUrl, request, Vault, FileSystemAdapter, DataAdapter } from 'obsidian';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	searchString: string;
	settingsBool: boolean;
	filelocation: string;
}

const savedSettings: MyPluginSettings = {
	searchString: 'Maier, Michael',
	settingsBool: true,
	filelocation: '/Personen/'
}


const vaultaccess = app.vault;

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// // This creates an icon in the left ribbon.
		// const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
		// 	// Called when the user clicks the icon.
		// 	new Notice('This is a notice!');
		// });
		// // Perform additional things with the ribbon
		// ribbonIconEl.addClass('my-plugin-ribbon-class');

		// // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		// const statusBarItemEl = this.addStatusBarItem();
		// statusBarItemEl.setText('Status Bar Text');

		// THis adds a simple command for lookup.
		this.addCommand({
			id: 'ndb-lookup',
			name: 'Lookup a historical figure on NDB',
			callback: () => {
				async function getData() {
					const response = await requestUrl({
						url: "http://data.deutsche-biographie.de/beta/solr-open/?q=defnam:%22" + savedSettings.searchString + "%22&wt=json",
						method: 'GET',
						contentType: 'JSON'
					});
					console.log(response.json.response.docs[1].r_leb_str);
					console.log(response.json.response.docs[1].defnam);
				}
				getData();


				// //check if folder exists, else create it
				// async function savelocationcheck() {
				// 	const folderExists = await FileSystemAdapter.exists(savedSettings.filelocation)
				
				// }
				
				
				// {
				// 	async function writeData() {
				// 		await vaultaccess.createFolder(
				// 			savedSettings.filelocation,
				// 			);
				// 	}
				// 	writeData();
				
			}
			
		});

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
				
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
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

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class LookUpModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Insert Name');
	}

	onClose() {
		const {contentEl} = this;
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

		containerEl.createEl('h2', {text: 'Deutsche Biographie Lookup'});

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
}
}

