'use babel';

import { CompositeDisposable } from 'atom';
import packageConfig from './config-schema.json';
$ = require('atom-space-pen-views').$;

const Codacy = {
	
	subscriptions: null,
	config: packageConfig,

	activate(state) {

		// Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
		this.subscriptions = new CompositeDisposable();

		// Register command that finds issues for this file
		this.subscriptions.add(atom.commands.add('atom-workspace', {
			'Codacy:findIssues': () => this.findIssues()
		}));

		// Listen for settings
		this.subscriptions.add(this.subscribeToConfigChanges());

		// Do main package functionality
		atom.workspace.onDidStopChangingActivePaneItem(function(e) {
			
			// If current item is a text editor, look for file issues
			if (e && e.constructor.name === "TextEditor") {
				atom.commands.dispatch(atom.views.getView(e), 'Codacy:findIssues');
			}
			
			// Hide status bar otherwise
			else {
				var codacyStatusBar = atom.workspace.panelForItem(document.getElementById('codacy-bottom-container'));
				if (codacyStatusBar !== null && codacyStatusBar.isVisible())
					codacyStatusBar.hide();
			}

			/* TODO: Rework this so it finds all issues and stores them
				// Get all text editors
				var editors = atom.workspace.getTextEditors();

				// Loop through text editors
				for (i in editors) {
					var thisPath = editors[i].getPath();
					
					// find file path
					// IF file path exists in stored paths
						// Do nothing
					// ELSE retrieve file issues from Codacy
						// Store response
				}

				// IF activePaneItem is textEditor
					// Update status
				// ELSE
					// Do nothing
			*/
		});

	},

	deactivate() {
		this.subscriptions.dispose();
	},

	findIssues(filePath) {

		// Find path for current active text editor
		if (typeof filePath === "undefined") {	
			editor = atom.workspace.getActivePaneItem();
			filePath = editor.getPath();
		}

		// Initialize vars
		var encodedFilePath = encodeURIComponent(atom.project.relativizePath(filePath)[1]),
			statusContainer = atom.workspace.panelForItem(document.getElementById('codacy-bottom-container')),
			projectToken = this.projectToken,
			issuesText = " issues found on Codacy",
			status = null,
			xhr = new XMLHttpRequest();
			
		//debugger;
		
		// Listen for request complete
		xhr.onreadystatechange = function() {
			if (this.readyState == 4 && this.status == 200) {
				
				// DEBUGGING Output response to console
				// console.log(xhr.response);
				
				// Create status element if not found
				if (statusContainer === null) {
					statusContainer = document.createElement('div');
					statusContainer.id = "codacy-bottom-container";
					statusContainer.innerHTML = "<div class=\"status icon\"></div><div class=\"content\"></div>";
					
					atom.workspace.addBottomPanel({
						item: statusContainer
					});
					
					statusContainer = atom.workspace.panelForItem(document.getElementById('codacy-bottom-container'))
				}
				
				// Find status elements
				status = statusContainer.item.querySelector('.status');
				content = statusContainer.item.querySelector('.content');
				
				// Reset Content
				content.innerHTML = "";
				content.classList.remove('expanded');

				// Update status
				if (xhr.response.data.length)
				{
					statusContainer.item.classList.add('issues');
					status.classList.remove('icon-check');
					status.classList.add('icon-x');
					if (xhr.response.data.length === 1)
						issuesText = issuesText.replace(/issues/, 'issue');
					status.innerText = xhr.response.data.length + issuesText;
					
					// Loop through issues
					var sortedIssues = xhr.response.data.sort(function(a, b){return a.startLine - b.startLine});
					for (i in sortedIssues) {
						
						var _this = sortedIssues[i],
							$issueRow = $("<div class='issue'></div>").appendTo($(content));

						var $lineElem = $(`<a class='line'>Line: ${_this.startLine}</a>`);
						var $textElement = $(`<a href="test.com" class='issueText'>${_this.message}</a>`);
						
						$issueRow.addClass(_this.level.toLowerCase());
						$issueRow.attr('data-cost', _this.cost);
						$issueRow.append($lineElem);
						$issueRow.append($textElement);
						
						$lineElem.on('click', function(e) {
							var $lineText = $(e.delegateTarget).text();
							var n = parseInt($lineText.replace("Line: ", ""));
							editor.moveToTop();
							editor.moveDown(n - 1);
						});
						//console.log(_this);
					}
				}
				
				else {
					statusContainer.item.classList.remove('issues');
					status.classList.remove('icon-x');
					status.classList.add('icon-check');
					status.innerText = "No" + issuesText;
				}
				
				// Show if hidden
				if (!statusContainer.isVisible())
					statusContainer.show();
					
				// Attach listener
				if (statusContainer.item.onclick === null) {
					
					// Toggle expanded
					statusContainer.item.onclick = function(e) {
						
						// Ignore click if not on status bar
						if (!e.target.classList.contains('status'))
							return;
						
						if (statusContainer.item.classList.contains('expanded'))
							statusContainer.item.classList.remove('expanded');
						else
							statusContainer.item.classList.add('expanded');
					}

				}
			}
		};
		
		// Set response type
		xhr.responseType = "json";
		
		// Make build request
		xhr.open("GET", "https://api.codacy.com/2.0/project/file/issues/" + encodedFilePath, true);
		
		// Set project_token header
		xhr.setRequestHeader('project_token', projectToken);
		
		// Do request
		xhr.send();
	
	},
	
	subscribeToConfigChanges() {
		const subscriptions = new CompositeDisposable();

		const codacySettingsObserver = atom.config.observe(
			'Codacy.projectToken',
			(value) => {
				this.projectToken = value;
			});
		subscriptions.add(codacySettingsObserver);

		return subscriptions;
	}

};

export default Codacy;