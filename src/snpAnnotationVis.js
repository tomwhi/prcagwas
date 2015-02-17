function makeSlideBar(min, max, step, value) {
	// Include a controller for changing the r2 threshold:
	var slideBar = document.createElement("input");
	slideBar.id = "paramControlsSlidebar";
	slideBar.type = "range";
	slideBar.min = min;
	slideBar.max = max;
	slideBar.step = step;
	slideBar.setAttribute("value", value);
	return slideBar;
}


// Generate the table of lead SNPs, using the specified r2 cutoff, for display on the
// main index page.
// For each lead SNP, show a row containing the following fields:
// - The SNP (name, chrom, pos, alleles fields)
// - # of LD proxies at that r2 threshold
// - Number of LD proxies "with annotations" at that r2 threshold)
// - List of significant eQTL genes
// - Link to the lead SNP's page
function makeLeadSNPtable(parentElement, ldInfoJSON, locusImageListJSON, annotationsJSON, eQtlJSON, r2) {
	// Will replace everything in this div:
	while (parentElement.firstChild) {
	    parentElement.removeChild(parentElement.firstChild);
	}
		
	var paramsDiv = document.createElement('div');
	paramsDiv.className = "params";
	paramsDiv.innerHTML = "Lead SNPs and proxy SNPs at r" + "2".sup() + " >= " + r2;
		
	parentElement.appendChild(paramsDiv);
	var leadSNPtable = document.createElement('table');
	leadSNPtable.setAttribute("class", "display");
	leadSNPtable.setAttribute("id", "leadSNPtable");
		
	var snpColGroup = document.createElement('colgroup');
	leadSNPtable.appendChild(snpColGroup);
	var section1cols = document.createElement('col');
	section1cols.span="3";
	section1cols.setAttribute("style", "background-color:#AFD4E6");
	snpColGroup.appendChild(section1cols);
	var section2cols = document.createElement('col');
	section2cols.span=Object.keys(eQtlJSON).length;
	section2cols.setAttribute("style", "background-color:#ADFFD6");
	snpColGroup.appendChild(section2cols);
		
	// Make the header row:
	var leadSNPtableHeader = document.createElement('thead');
	leadSNPtable.appendChild(leadSNPtableHeader);
	var headerRow = document.createElement('tr');

	// The last part of the table header is dynamic,
	// with names taken from the keys of the eQTL data object.
	headerRow.innerHTML = "<th>Lead SNP (hg19) (click to open)</th><th># proxies at r" + "2".sup() + " >= " + r2 + "</th><th># with top 2\% DNase</th>";
	cohortNames = Object.keys(eQtlJSON);
	var cohortNamesString = "";
	if (cohortNames.length > 0) {
		cohortNamesString = "<th>eQTL <i>q</i>-values:<br>" + cohortNames.reduce(function(elem1, elem2) {return elem1 + "/" + elem2;}) + "<br>Note: \"0\" means permutation <i>p</i>-value < 1E-5</th>";
	}
	headerRow.innerHTML = headerRow.innerHTML + cohortNamesString;
	leadSNPtableHeader.appendChild(headerRow);
		
	parentElement.appendChild(leadSNPtable);

	var leadSNPtableBody = document.createElement('tbody');
	leadSNPtable.appendChild(leadSNPtableBody);

	// Generate a row in the table for each lead SNP...
	jQuery.each(ldInfoJSON, function(currLeadSNPstring, ldProxyInfo) {
		// In each row, include the following fields:
		// - Lead SNP details
		// - # of LD proxies at that r2 threshold
		// - Number of LD proxies "with annotations" at that r2 threshold)
		// - A button for accessing the ld proxies page for this lead SNP
		// - A list of significant eQTL genes

		var currRow = document.createElement('tr');
		leadSNPtableBody.appendChild(currRow);
			
		var btnCell = document.createElement('td');
		var btn = document.createElement("BUTTON");
		btn.className = "linkerButton";
		currRow.appendChild(btnCell);
		btnCell.appendChild(btn);
		btn.innerHTML = currLeadSNPstring;

		// Get the set of LD proxies for this lead SNP, at the specified
		// r2 threshold:
		var filteredLDproxies = [];
		jQuery.each(ldProxyInfo, function(proxyName, proxyR2){
			if (proxyR2 >= r2) {
				filteredLDproxies.push(proxyName);
			}
	    });

		// # of LD proxies field:
		var numProxiesField = document.createElement('td');
		numProxiesField.innerHTML = filteredLDproxies.length;
		currRow.appendChild(numProxiesField);

		// Get the set of LD proxies "with evidence", for this r2 threshold:
		var ldProxiesWithAnnots = filteredLDproxies.filter(function(arrValue, arrIndex, arr) {
			// Get the annotation for this proxy:
			proxyHasEvidence = false;
			if (typeof annotationsJSON[arrValue] !== 'undefined') {
				var currProxyAnnot = new SNP_Annotation(annotationsJSON[arrValue]);
			
				if (currProxyAnnot.withEvidence()) {
					proxyHasEvidence = true;
				}
			}

			if (proxyHasEvidence) {
				return true;
			} else {
				return false;
			}
		});
			
		var numProxiesWithEvidenceField = document.createElement('td');
		numProxiesWithEvidenceField.innerHTML = ldProxiesWithAnnots.length;
		currRow.appendChild(numProxiesWithEvidenceField);

		// Adding on 5th August 2014. This code is getting rather messy...
		// Get the set of LD proxies "with evidence", for this r2 threshold:

		// Add a field indicating the number with crmViewFile set:
		//var ldProxiesWithViewFile = filteredLDproxies.filter(function(arrValue, arrIndex, arr) {
		//	if ((typeof annotationsJSON[arrValue] !== 'undefined') && (typeof annotationsJSON[arrValue].crmViewFile !== 'undefined')) {
		//		return true;
		//	} else {
		//		return false;
		//	}
		//});

		//var numProxiesWithViewField = document.createElement('td');
		//numProxiesWithViewField.innerHTML = ldProxiesWithViewFile.length;
		//currRow.appendChild(numProxiesWithViewField);

		// Generate a single eQTL field for this lead SNP, encompassing all cohorts...

		// Will record the significant genes at this r2 threshold, along with
		// their q-values for each of the cohorts:
		var gene2cohort2qval = {};
		for (cohortName in eQtlJSON) {
			// Get all eQTL genes for this lead SNP, for this r2 threshold...
			
			// NOTE: This data structure links from SNP to a list of probesets for that
			// SNP, which must all correspond to significant genes (predefined, not
			// figured out here), also stating the stats for that given SNP/probeset
			// pair. SNP must be specified as a chrom_pos_name string.

			// NOTE : This is another nasty hack due to having to the asynchronous
			// ajax call; have to use an index to retrieve the snp and gene level
			// data, rather than being able to use the cohortName as a key:		
			eQTLgeneLevelJSON = eQtlJSON[cohortName][0][r2];
			eQTLsnpLevelJSON = eQtlJSON[cohortName][1];
			
			// Get the (potentially) significant genes for all of the current ld proxies:
			var sigGenes = {};
			for (var proxyIdx = 0; proxyIdx < filteredLDproxies.length; proxyIdx++) {
				currLDproxy = filteredLDproxies[proxyIdx];
				proxyName = currLDproxy.split("_")[2];
				currProxy_eQTLdata = eQTLsnpLevelJSON[proxyName];
								
				// FIXME: Nasty hack here to deal with the no-name genes (from unassigned
				// probesets):
				for (var probesetName in currProxy_eQTLdata) {
					geneName = probesetName.split("_")[0];
					if (geneName == "NoHugoOverlap") {
						geneName = probesetName;
					}
					sigGenes[geneName] = 1;
				}
			}

			// NOTE: The above set of genes might not be significant *at the current
			// r2 threshold*; only report those genes that *are* significant:
			for (currGene in sigGenes) {
				if (currGene in eQTLgeneLevelJSON) {
					if (!(currGene in gene2cohort2qval)) {
						gene2cohort2qval[currGene] = {};
					}
					currQvalString = eQTLgeneLevelJSON[currGene][1];
					if (currQvalString != "?") {
						currQvalString = eQTLgeneLevelJSON[currGene][1].toPrecision(2);
					}
					gene2cohort2qval[currGene][cohortName] = currQvalString;
				}
			}
		}

		// Generate the eQTL output field:
		currGenesOutputStrs = [];
		for (gene in gene2cohort2qval) {
			qValOutputs = [];
			for (cohort in eQtlJSON) {
				currQval = gene2cohort2qval[gene][cohort];
				if (typeof currQval !== 'undefined') {
					qValOutputs.push(currQval);
				} else {
					qValOutputs.push("?");
				}
			}
			currOutputStr = gene + ": " + qValOutputs.reduce(function(qVal1, qVal2) {
				return qVal1 + "/" + qVal2;
			});
			currGenesOutputStrs.push(currOutputStr);
		}

		var sigGenesStr = "";
		if (currGenesOutputStrs.length > 0) {
			sigGenesStr = currGenesOutputStrs.reduce(function(elem1, elem2) {
				return elem1 + "<br>" + elem2;
			});
		}

		if (Object.keys(eQtlJSON).length > 0) {
			var eQTLgenesField = document.createElement('td');
			eQTLgenesField.innerHTML = sigGenesStr;
			currRow.appendChild(eQTLgenesField);
		}

		// NOTE: I will pass in the actual objects upon the click, and will
		// defer processing them (e.g. stringifying, extracting relevant items
		// etc.) until that button is clicked:
		btn.onclick = function() {
			btn.className = "clicked";
			openLdProxiesWindow(currLeadSNPstring, r2, locusImageListJSON[currLeadSNPstring], ldInfoJSON[currLeadSNPstring], annotationsJSON, eQtlJSON, gene2cohort2qval);
		};
		
		$.getScript("./lib/jquery.dataTables.js", function(){
			$('#leadSNPtable').dataTable( {
				"lengthMenu": [ [10, 25, 50, -1], [10, 25, 50, "All"] ],
				"aaSorting": [[ 2, "desc" ]],
				"iDisplayLength" : -1,
				"bDestroy" : true
			} );
		});
	});
}



function makeAnnotTableRows(annotListURL, resDir, tableBody) {	
	// Parse the list of annotations from the specified file, and then process
	// the resulting entries into a table, in the callback function...
	jQuery.getJSON(annotListURL, function(annotList){
		// If the file was parsed successfully, then the code here in this "callback"
		// function will get executed.

		// Generate the table contents; for each annotation item...
		var rowIdx = 0
	    jQuery.each(annotList, function(snpString, annotFileLoc){
	    	// Generate a table row for the current annotation...
	    	makeAnnotTableRow(rowIdx, snpString, annotFileLoc, tableBody);
	    	rowIdx = rowIdx + 1;
	    });
  	});
}


function makeAnnotTableRow(rowIdx, annotFileURL, resDir, tableBody) {	
	// Parse the annotation object from the JSON file, and then do the following inside
	// the callback function:
	// - Generate a SNP_annotation object from it
	// - Process the resulting entries into the specified table at the specified row index
	jQuery.getJSON(annotFileURL, function(annotationJSON){
		// If the file was parsed successfully, then the code here in this "callback"
		// function will get executed.

		// Generate a SNP_Annotation object from the json parsing result:
		var snpAnnot = new SNP_Annotation(annotationJSON);
		
		// Generate the table row...

		// NOTE: Of course, now "rowSelector" will select the *new* last row in the table.
		
		// Add cells to the new (last) row, displaying info for the SNP annotation:
		snpAnnot.writeTableCells(rowSelector);
		
		// The second part of the row will contain a button, which will open up the
		// annotation page for the SNP when clicked, and will then set a variable
		// "on that page" (?) to be the annotation file URL, allowing it to retrieve
		// and use the annotation information too...
		
		// Make a table cell for the button:
		// FIXME: I *think* this will work, but not 100% sure:
		var lastCellSelector = '#' + tableName + ' tr:last td:last';
		
		// Add the button to that cell:
		makeAnnotViewButton(lastCellSelector, annotFileURL)
  	});
}


// Modified on 18th July: leadSNPstring is really just a string specifying
// chrom, pos, name; it can't be turned into a SNP object (or can it?).
function openLdProxiesWindow(leadSNPstring, r2thresh, locusImgURL, ldProxyInfoJSON, annotationsJSON, eQtlJSON, eQTLgene2cohort2qval) {
	var ldProxiesWindow = window.open('ldProxiesVis.html');

	var ldProxyInfoString = JSON.stringify(ldProxyInfoJSON);
	var annotationsString = JSON.stringify(annotationsJSON);
	var eQtlString = JSON.stringify(eQtlJSON);
	var eQTLgene2cohort2qvalString = JSON.stringify(eQTLgene2cohort2qval);

	ldProxiesWindow.leadSNPstring = leadSNPstring;
	ldProxiesWindow.r2thresh = r2thresh;
	ldProxiesWindow.locusImgURL = locusImgURL;
	ldProxiesWindow.ldProxyInfoString = ldProxyInfoString;
	ldProxiesWindow.annotationsString = annotationsString;
	ldProxiesWindow.eQtlString = eQtlString;
	ldProxiesWindow.eQTLgene2cohort2qvalString = eQTLgene2cohort2qvalString;
}


// Generates a table summarising LD proxies and their annotations, also linking to
// the individual annotation display pages.
function makeLDproxiesTable(tableDiv, ldProxyInfoJSON, annotationsJSON, eQtlJSON, eQTLgene2cohort2qval, r2, pwmChIPseqStrength, leadSNPstring) {
	// Replaces everything in the input div element:
	tableDiv.className = "dataBox";

	while (tableDiv.firstChild) {
	    tableDiv.removeChild(tableDiv.firstChild);
	}
		
	var paramsDiv = document.createElement('div');
	paramsDiv.className = "params";
	paramsDiv.innerHTML = "Proxy SNPs at r" + "2".sup() + " >= " + r2;
	tableDiv.appendChild(paramsDiv);
	
	var notesDiv = document.createElement('div');
	notesDiv.className = "notes";
	tableDiv.appendChild(notesDiv);
	notesDiv.innerHTML = notesDiv.innerHTML + "<ul><li>eQTL associations are shown for genes with <i>q</i> <= 0.05 in at least 1 cohort, considering all proxies with r2 >= 0.3 for a lead SNP.</li><li>ChIP-seq PWM indicates the minimum <i>p</i>-value of all occupied PWM instances disrupted by the SNP.</li> <li>DNase PWM indicates the minimum <i>p</i>-value of PWM instances disrupting the SNP if in LNCaP open chromatin.</li></ul>";
	
	var proxiesTable = document.createElement('table');
	proxiesTable.setAttribute("class", "display");
	proxiesTable.setAttribute("id", "proxiesTable");

	var colGroup = document.createElement('colgroup');
	proxiesTable.appendChild(colGroup);
	var section1cols = document.createElement('col');
	section1cols.span="11";
	section1cols.setAttribute("style", "background-color:#AFD4E6");
	colGroup.appendChild(section1cols);
	var section2cols = document.createElement('col');
	section2cols.span=Object.keys(eQtlJSON).length;
	section2cols.setAttribute("style", "background-color:#ADFFD6");
	colGroup.appendChild(section2cols);

	tableDiv.appendChild(proxiesTable);
	var tableHeader = document.createElement('thead');
	proxiesTable.appendChild(tableHeader);
	var headerRow = document.createElement('tr');
	headerRow.innerHTML = "<th>Proxy Name</th><th>Proxy Pos. (hg19)</th><th>Proxy Alleles</th><th>r" + "2".sup() + "</th><th>Annotation link</th><th>IGV view</th><th># DNase</th><th>Max. DNase %</th><th># ChIP-seq</th><th>ChIP-seq PWM</th><th>DNase PWM</th>";
	for (cohortName in eQtlJSON) {
		headerRow.innerHTML = headerRow.innerHTML + "<th>eQTL: " + cohortName + "</th>";
	}
	tableHeader.appendChild(headerRow);

	//var tableBody2 = document.createElement('tbody');
	//proxiesTable.appendChild(tableBody2);

	//tableBody2.innerHTML = "<tr><td>test1</td><td>1</td><td>A,T</td><td>0.5</td></tr><tr><td>test2</td><td>2</td><td>A,T</td><td>0.6</td></tr>";

	var tableBody = document.createElement('tbody');
	proxiesTable.appendChild(tableBody);

	for (ldProxy in ldProxyInfoJSON) {
		if (ldProxyInfoJSON[ldProxy] >= r2) {
			// This proxy passes the specified r2 threshold => include it in the table...
			var newRow = document.createElement('tr');
			tableBody.appendChild(newRow);
			
			// SNP details:
			var currProxyAnnot = new SNP_Annotation(annotationsJSON[ldProxy]);
			currProxySNP = currProxyAnnot.snv;
			currProxySNP.makeTableCells(newRow, false);
			
			// r2:
			r2cell = document.createElement('td');
			r2cell.innerHTML = ldProxyInfoJSON[ldProxy];
			newRow.appendChild(r2cell);
			
			// Link to annotation page:
			currAnnotString = currProxyAnnot.toJSONstring();
			var linkField = document.createElement('td');
			newRow.appendChild(linkField);
			makeAnnotViewButton(linkField, currAnnotString);
			
			currProxyAnnot.makeIGVviewCell(newRow);
			
			// DNase element, DNase signal, ChIP-seq PWM, DNase PWM:
			currProxyAnnot.makeDNaseElemCell(newRow);
			currProxyAnnot.makeDNaseSignalCell(newRow);
			currProxyAnnot.makeChIPseqCell(newRow);
			currProxyAnnot.makeChIPseqPWMcell(newRow, pwmChIPseqStrength);
			currProxyAnnot.makeDNasePWMcell(newRow);

			// A bit hacky; extract SNP name from SNP string:
			proxyName = ldProxy.split("_")[2];
			
			// Get and report eQTL associations for all genes for this SNP, for all cohorts...
			for (cohortName in eQtlJSON) {
				gene2eQTL = {};
				for (gene in eQtlJSON[cohortName][1][proxyName]) {
					gene2eQTL[gene] = eQtlJSON[cohortName][1][proxyName][gene];
				}
				makeEqtlCell(newRow, gene2eQTL);
			}
		}
	}

	$.getScript("./lib/jquery.dataTables.js", function() {
		$('#proxiesTable').dataTable( {
			"aaSorting": [[ 9, "desc" ]],
			"iDisplayLength" : -1,
			"bDestroy" : true
		} );
	});
}


function makeEqtlCell(rowElement, gene2eQTL) {
	var eQTLfield = document.createElement('td');
	rowElement.appendChild(eQTLfield);

	var summaryString = "";
	if (typeof gene2eQTL !== 'undefined') {
		// Just show each gene, along with it's "beta" and p-value, comma-separated:
		summaryStrings = [];
		for (gene in gene2eQTL) {
			if (typeof(gene2eQTL[gene].beta) == "string") {
				currBetaStr = gene2eQTL[gene].beta;
			} else {
				currBetaStr = gene2eQTL[gene].beta.toPrecision(2);
			}
			summaryString = gene + ":<i>p</i>=" + gene2eQTL[gene].p.toPrecision(2) + ",<i>&beta;</i>=" + currBetaStr + " ";
			summaryStringFixedHyphen = summaryString.replace("-", "&#8209;");
			summaryStrings.push(summaryStringFixedHyphen);
		}

		summaryString = summaryStrings.reduce(function(elem1, elem2) {
			return elem1 + "<br>" + elem2;
		}, "");
	}

	eQTLfield.innerHTML = summaryString;
}


function makeAnnotViewButton(docElement, snpAnnotString) {
	// Adds a button to the specified DOM element. This button will bring the
	// user to a new annotation visualisation page when clicked, showing the
	// SNP annotation contained in JSON format at the specified URL:

	var btn = document.createElement("BUTTON");
	btn.className = "linkerButton";
	btn.innerHTML = "Show annotation";
	docElement.appendChild(btn);
	btn.onclick = function() {
		btn.className = "clicked";
		openAnnotWindow(snpAnnotString)
	};
}


function openAnnotWindow(snpAnnotString) {
	// Open a new annotation view window:
	var annotWindow = window.open('singleSNPvis.html');
		
	// Set the location of the annotation file for that window, so it can load the
	// annotation information:
	annotWindow.snpAnnotString = snpAnnotString;
}


// Class definitions follow here. Trying to define it in the same way as on page 202 of
// "JavaScript: The Definitive Guide, 6th edition".

// SNP class:
function SNP(snpJSON) {
	// Set chrom, pos, name, and allele seqs:
	this.chrom = snpJSON.chrom;
	this.refPos = snpJSON.refPos;
	this.name = snpJSON.name;
	this.alleleSeqs = snpJSON.alleleSeqs;
}


SNP.prototype = {
	makeTableCells: function(rowElement, includeChrom) {
		nameField = document.createElement('td');
		nameField.innerHTML = this.name;
		rowElement.appendChild(nameField);
		if (includeChrom) {
			chromField = document.createElement('td');
			chromField.innerHTML = this.chrom;
			rowElement.appendChild(chromField);
		}
		posField = document.createElement('td');
		posField.innerHTML = this.refPos;
		rowElement.appendChild(posField);
		allelesField = document.createElement('td');
		allelesField.className = "dnaSeq";

		allelesList = this.alleleSeqs;
		var allelesText = allelesList.reduce(function(elem1, elem2) {
		    return elem1 + "<br>" + elem2;
		});

		allelesField.innerHTML = allelesText;
		rowElement.appendChild(allelesField);		
	},
	
	makeSummary: function(docElement) {
		var snpTable = document.createElement('table');
		var header = document.createElement('thead');
		var headerRow = document.createElement('tr');
		headerRow.innerHTML = "<th>Name</th><th>Chrom</th><th>Position</th><th>Alleles</th>";
		header.appendChild(headerRow);
		snpTable.appendChild(header);
		var detailsRow = document.createElement('tr');
		this.makeTableCells(detailsRow, true);
		snpTable.appendChild(detailsRow);

		var snpSummaryDiv = document.createElement('div');
		snpSummaryDiv.appendChild(snpTable);

		// Make summary of this SNP:
		docElement.appendChild(snpSummaryDiv);
	}
}


// The SNP annotation class.
function SNP_Annotation(annotationJSON) {
	// annotationJSON is a JSON-formatted object-literal with all fields required for
	// constructing this object.
	snpJSON = annotationJSON.snv;
	this.snv = new SNP(snpJSON);

	featuresJSON = annotationJSON.annotFeatures;

	var features = {};

	// Iterate over the name:value pairs in the features object literal, and generate
	// a new AnnotationFeature instance from each of these:
	// FIXME: I want to have subclasses of AnnotationFeature, but I'm not sure how to
	// do this yet. Perhaps I can get away with some crazy "duck-typing" sh*t though?
	for (featureName in featuresJSON) {
		currFeatureJSON = featuresJSON[featureName];
		
		// FIXME: Weird design flaw/oversight: I have duplicated the "featureName"
		// variable.
		var currFeature = new AnnotationFeature(featureName, currFeatureJSON);

		features[featureName] = currFeature;
    }

	this.annotFeatures = features;

	this.crmViewFile = annotationJSON.crmViewFile;
	this.dnaViewFile = annotationJSON.dnaViewFile;
}


SNP_Annotation.prototype = {
	toJSONstring: function() {
		// FIXME: I predict this might cause problems in the future. Here, I have
		// implemented a function to convert to JSON, because JSON.Stringify will
		// not produce a string that can directly be reconstituted into a snp_annotation
		// object, due to me storing featurename and featurevalue attributes. It's a
		// bit of a mess and there must be a cleaner solution.

		// Convert this object to a JSON-formatted string, such that the string
		// can be reconstituted to a JSON object and then converted back into an
		// identical instance of this class via the class' constructor.
		
		snpString = JSON.stringify(this.snv);
		jsonString = "\"snv\":" + snpString;
		if (this.crmViewFile !== 'undefined') {
			crmViewString = "\"crmViewFile\":\"" + this.crmViewFile + "\"";
			jsonString = jsonString + ", " + crmViewString;
		}
		if (this.dnaViewFile !== 'undefined') {
			dnaViewString = "\"dnaViewFile\":\"" + this.dnaViewFile + "\"";
			jsonString = jsonString + ", " + dnaViewString;
		}
		
		if (this.annotFeatures !== 'undefined') {
			// Generate each featureName/featureValue pair string, and then reduce
			// that into a single string...
			featureStringArr = [];
			for (featureName in this.annotFeatures) {
				currFeatureString = "\"" + featureName + "\" : " + JSON.stringify(this.annotFeatures[featureName].featureValue);
				featureStringArr.push(currFeatureString);
			}
			
			var combinedString = featureStringArr.reduce(function(elem1, elem2) {
			    return elem1 + ", " + elem2;
			});

			featuresString = "\"annotFeatures\":{" + combinedString + "}";

			jsonString = jsonString + ", " + featuresString;
		}
		return "{" + jsonString + "}";
	},

	// FIXME: Not implementing here? Need to control ordering of annotation feature cells?
	writeTableCells: function(selector) {
		// Generate cells in the specified table for this SNP annotation...
		
		// Make a cell for the SNP:
		newCell = jQuery(selector).after('<td></td>');
		this.snv.makeSummary(newCell);
		
		// FIXME:
		// Soon, add a summary of the annotation features here.
	},
	
	withEvidence: function() {
		// Returns true if shows evidence of functionality, false otherwise:
		evidence = false;
		
		// Modifying; just hard-coding to consider (DNase) score percentile values
		// at this point:
		if (typeof this.annotFeatures['name2scoreAndPercentile'].featureValue !== 'undefined') {
			feature = this.annotFeatures['name2scoreAndPercentile'];
			if (feature.showsEvidence()) {
				evidence = true;
			}
		}
		return evidence;

		// If I decide to consider other features again, then use this code again
		// (modify above and eliminate the return statement):
		for (featureName in this.annotFeatures) {
			feature = this.annotFeatures[featureName];
			if (feature.showsEvidence()) {
				evidence = true;
			}
		}
		return evidence;
	},

	makeIGVviewCell: function(rowElement) {
		newCell = document.createElement('td');
		rowElement.appendChild(newCell);

		if (typeof this.crmViewFile === 'undefined') {
			newCell.innerHTML = "No";
		} else {
			newCell.innerHTML = "Yes";
		}
	},

	// Ugly, unmaintanable code again (e.g. hard-coded names of features), due to me not
	// properly figuring how inheritance in javascript and a suitable "design pattern"
	// for the annotation features:
	makeDNaseElemCell: function(rowElement) {
		newCell = document.createElement('td');
		rowElement.appendChild(newCell);

		if (typeof this.annotFeatures['dnase'].featureValue === 'undefined') {
			return;
		}

		newCell.innerHTML = this.annotFeatures['dnase'].featureValue.length;
	},

	makeDNaseSignalCell: function(rowElement) {
		newCell = document.createElement('td');
		rowElement.appendChild(newCell);

		if (typeof this.annotFeatures['name2scoreAndPercentile'].featureValue !== 'undefined') {
			dnaseSignals = this.annotFeatures['name2scoreAndPercentile'].featureValue;
			maxPercentile = 0;
			for (signalName in dnaseSignals) {
				currPercentile = dnaseSignals[signalName][1];
				if (currPercentile > maxPercentile) {
					maxPercentile = dnaseSignals[signalName][1];
				}
			}
			newCell.innerHTML = maxPercentile.toPrecision(3);
		}
	},
	
	makeChIPseqCell: function(rowElement) {
		newCell = document.createElement('td');
		rowElement.appendChild(newCell);

		if (typeof this.annotFeatures['chipseq'].featureValue === 'undefined') {
			return;
		}

		newCell.innerHTML = this.annotFeatures['chipseq'].featureValue.length;
	},
	
	makeChIPseqPWMcell: function(rowElement, signalCutoff) {
		var newCell = document.createElement('td');
		rowElement.appendChild(newCell);

		if (typeof this.annotFeatures['motifEffects'] === 'undefined') {
			return;
		}

		// Changed, August 5th: Just consider the "direct" PWMs when generating this
		// summary...
		var pwms = this.annotFeatures['motifEffects'].featureValue;
		var bestScore = -1;
		var bestPWM = null;
		for (var pwmIdx = 0; pwmIdx < pwms.length; pwmIdx++) {
			pwmAttribs = pwms[pwmIdx];

			var pwmName = pwmAttribs['motifName'];
			var motifIsDirect = testIfDirect(pwmName);

			// Added on 26th September 2014: Filter on matched ChIP-seq
			// distance and signal strength:
			var passesSignalCutoff = false;
			for (var chipseqIdx = 0; chipseqIdx < pwmAttribs.matchedPeaks.length; chipseqIdx++) {
				currChIPseq = pwmAttribs.matchedPeaks[chipseqIdx];
				if (currChIPseq[6] >= signalCutoff) {
					passesSignalCutoff = true;
				}
			}
			
			if (motifIsDirect && passesSignalCutoff && (pwmAttribs.bestAlleleScore > bestScore)) {
				bestScore = pwmAttribs.bestAlleleScore;
				bestPWM = pwmAttribs.motifName;
			}
		}

		if (bestScore > 0) {
			var bestP = Math.pow(10, -bestScore)
			//bestPWM + ": p=" + bestP.toExponential(3);
			newCell.innerHTML = bestP.toExponential(3);
		}
	},

	// HACKY: Copying and pasting code from above:
	makeDNasePWMcell: function(rowElement) {
		var newCell = document.createElement('td');
		rowElement.appendChild(newCell);

		if (typeof this.annotFeatures['motifEffects_dnase'] === 'undefined') {
			return;
		}

		var pwms = this.annotFeatures['motifEffects_dnase'].featureValue;
		var bestScore = -1;
		var bestPWM = null;
		for (var pwmIdx = 0; pwmIdx < pwms.length; pwmIdx++) {
			pwmAttribs = pwms[pwmIdx];

			if (pwmAttribs.bestAlleleScore > bestScore) {
				bestScore = pwmAttribs.bestAlleleScore;
				bestPWM = pwmAttribs.motifName;
			}
		}

		if (bestScore > 0) {
			var bestP = Math.pow(10, -bestScore)
			newCell.innerHTML = bestP.toExponential(3);
		}
	},

	makeVis: function(docElement, motif2tfs, shortVersion) {
		// Generates a (potentially large) visualisation of this SNP annotation, to
		// go inside a webpage at a specified element:
		
		// Write out the SNP:
		var snpTitle = document.createElement('h2');
		if (!shortVersion) {
			snpTitle.innerHTML = "Annotated SNP";
		}
		snpDiv = document.createElement('div');
		snpDiv.className = "snpBox";
		if (shortVersion) {
			snpDiv.className += " borderless";
		}
		snpDiv.appendChild(snpTitle);
		this.snv.makeSummary(snpDiv);
		docElement.appendChild(snpDiv);

		// Put the SNP annotation summary table in a new div...
		var snpAnnotTableDiv = document.createElement('div');
		snpAnnotTableDiv.className = "dataBox spacedTopAndBottom";
		if (shortVersion) {
			snpAnnotTableDiv.className += " borderless";
		}
		if (!shortVersion) {
			var tableTitle = document.createElement('h2');
			tableTitle.innerHTML = "Annotations";
			snpAnnotTableDiv.appendChild(tableTitle);
		}
		var annotTable = document.createElement('table');
		annotTable.className = "annotationTable";
		snpAnnotTableDiv.appendChild(annotTable);
		
		var features = this.annotFeatures;

		// Generate a visualisation for the features (hard-coding the
		// set here), in a new table row...
		
		// HACK: Changing on 30th September 2014, to allow display of
		// shortened version (mainly for collating pdf for paper):
		if (shortVersion) {
			var pwmRow = document.createElement('tr');
			var valueCell = document.createElement('td');
			var feature = features["motifEffects"];
			feature.makeVis(valueCell, motif2tfs, shortVersion);
			pwmRow.appendChild(valueCell);
			annotTable.appendChild(pwmRow);
		} else {
			featuresToDisplay = {
				"chipseq" : "ChIP-seq peaks",
				"dnase" : "DNase regions",
				"name2scoreAndPercentile" : "DNase percentiles",
				"motifEffects" : "PWMs matching<br>ChIP-seq",
				"motifEffects_dnase" : "PWMs at DNase"
			}
			jQuery.each(featuresToDisplay, function(featureName, displayName) {
				// Two cells in the table row: feature name and feature value:
				var newRow = document.createElement('tr');
				var nameCell = document.createElement('td');
				nameCell.className = "namesColumn";
				nameCell.innerHTML = displayName;
				var valueCell = document.createElement('td');
				var feature = features[featureName];
				feature.makeVis(valueCell, motif2tfs, shortVersion);
				newRow.appendChild(nameCell);
				newRow.appendChild(valueCell);
				annotTable.appendChild(newRow);
			});
		}

		docElement.appendChild(snpAnnotTableDiv);

		// Add an image showing the CRM-level and DNA-level views,
		// if they are non-null...
		
		// Presently, assume they are both defined or both undefined:
		if (!(typeof this.crmViewFile === 'undefined')) {
			if (shortVersion) {
				// Short version: Just show the crm view image in a div:
				var igvImageDiv = document.createElement('div');
				igvImageDiv.className = "dataBox borderless";

				var crmViewImg = document.createElement('img');
				crmViewImg.style.width='1000px';
				crmViewImg.src = "./resources/" + this.crmViewFile;
				igvImageDiv.appendChild(crmViewImg);
				docElement.appendChild(igvImageDiv);
			} else {
				// Make a table showing the two images side-by-side
				var igvImageTable = document.createElement('table');
				var header = document.createElement('thead');
				igvImageTable.appendChild(header);
				var headRow = document.createElement('tr');
				headRow.innerHTML = "<td><h2>CRM-level view</h2></td><td><h2>DNA-level view</h2></td>";
				header.appendChild(headRow);
				var imgSection = document.createElement('tbody');
				igvImageTable.appendChild(imgSection);
				var imgRow = document.createElement('tr');
				imgSection.appendChild(imgRow);
				var crmCell = document.createElement('td');
				imgRow.appendChild(crmCell);
				var crmViewImg = document.createElement('img');
				crmViewImg.style.width='1000px';
				crmViewImg.src = "./resources/" + this.crmViewFile;
				crmCell.appendChild(crmViewImg);
				var dnaCell = document.createElement('td');
				imgRow.appendChild(dnaCell);
				var dnaViewImg = document.createElement('img');
				dnaViewImg.style.width='1000px';
				dnaViewImg.src = "./resources/" + this.dnaViewFile;
				dnaCell.appendChild(dnaViewImg);
				docElement.appendChild(igvImageTable)
			}
		}
	}
}


// AnnotationFeature class. If I were doing this in java or python I would make this
// an abstract class or perhaps an interface:
function AnnotationFeature(featureName, featureJSON) {
	// I need to have subtypes of AnnotationFeature, determined
	// by the featureName passed in here. I'll try implementing this by storing
	// the featureName value, and then having different behaviour inside
	// the AnnotationFeature prototype methods depending on that value. This is not using
	// inheritance, since I don't understand javascript inheritance.
	this.featureName = featureName;
	
	// Irrespective of the type of annotation, just store the given object literal.
	// However, the manner in which that object literal is used will depend on
	// the type of the feature, which is specified by this.featureName:
	this.featureValue = featureJSON;
}


AnnotationFeature.prototype = {
	showsEvidence: function() {
		// Currently, returns true if any of the DNase signals are in the top 2%:
		if (this.featureName == "name2scoreAndPercentile") {
			var withHighSignal = false;
			dnaseSignals = this.featureValue;
			if (!(typeof dnaseSignals === 'undefined')) {
				for (name in dnaseSignals) {
					signalTup = dnaseSignals[name];
					if (signalTup[1] >= 0.98) {
						withHighSignal = true;
					}
				}
			}
			return withHighSignal;
		}
	},

	makeVis: function(docElement, motif2tfs, shortVersion) {
		console.log("IN MAKEVIS.");
		
		// Make summary of this SNP; action depends on the type of this annotation
		// feature:
		if (typeof this.featureValue === 'undefined') {
			// This feature is not defined, so don't add anything to the docElement.
		} else if (this.featureName == "dnase") {
			// Just add a comma-separated list of the DNase elements as text in
			// the specified element:

			dnaseList = this.featureValue;

			var dnaseText = "";
			if (dnaseList.length > 0) {
				dnaseText = dnaseList.reduce(function(elem1, elem2) {
			    	return elem1 + ", " + elem2;
				});
			}

			docElement.innerHTML = dnaseText;
		} else if (this.featureName == "name2scoreAndPercentile") {
			dnaseSignals = this.featureValue;
			
			// Currently just adding text with a comma-separated list
			// of name:signal pairs...

			signalTextArr = [];
			jQuery.each(dnaseSignals, function(name, signalVal) {
				signalTextArr.push(name + ": " + (100*signalVal[1]).toPrecision(3) + "\%");
			});
			
			var signalText = "";
			if (signalTextArr.length > 0) {
				signalText = signalTextArr.reduce(function(elem1, elem2) {
			    	return elem1 + ", " + elem2;
				});
			}	
			
			docElement.innerHTML = signalText;
		} else if (this.featureName == "chipseq") {
			// Just add a comma-separated list of the unique tissue/target pairs that
			// have nearby peaks, as text in the specified element:
			peaksList = this.featureValue;
			
			tissue2targets = {};
			for (var peakIdx = 0; peakIdx < peaksList.length; peakIdx++) {
				currPeak = peaksList[peakIdx];
				tissue = currPeak[1];
				target = currPeak[2];
				if (!(tissue in tissue2targets)) {
					tissue2targets[tissue] = {};
				}
				tissue2targets[tissue][target] = 1;
			}

			tissueStrings = [];
			for (tissue in tissue2targets) {
				targets = Object.keys(tissue2targets[tissue]);
				targets.sort();
				currTissueString = "<b>" + tissue + "</b>: " + targets.reduce(function(elem1, elem2) {
				    return elem1 + ", " + elem2;
				}) + "\n";
				tissueStrings.push(currTissueString);
			}
			
			var outputText = "";
			tissueStrings.sort();
			if (tissueStrings.length > 0) {
				outputText = tissueStrings.reduce(function(elem1, elem2) {
				    return elem1 + "<br>" + elem2;
				});
			}

			docElement.innerHTML = outputText;
		} else if ((this.featureName == "motifEffects_dnase") || (this.featureName == "motifEffects")) {

			// Add content visualising all affected PWMs...
			
			// Show the affected PWMs in blocks, grouped according to the TF that
			// they correspond to. For each such TF, show:
			// - The single most strongly-affected PWM in a block at the top,
			// - A "click to expand" accordion option for showing the rest of the PWMs,
			// sorted by best allele score.
			
			affectedPWMs = this.featureValue;

			// Quite hacky code, because I'm getting familiar with Jquery UI
			// whilst coding this...

			// Group the PWMs according to TF, and for each TF have two classes of PWM:
			// 1) PWMs likely to represent the TF's direct DNA binding specificity
			// 2) PWMs likely to represent indirect / co-binding DNA binding specificity
			// For each class, sort the PWMs according to PWM score.
			tf2type2pwmEffects = groupPWMeffects(affectedPWMs, motif2tfs);
			
			var allTFsDiv = document.createElement('div');
			//allTFsDiv.setAttribute("id", "accordion");
			docElement.appendChild(allTFsDiv);

			// HACK: 30th September 2014: Adapting to just show the single best
			// "top" motif for each TF, if short display is specified...
			if (shortVersion) {
				// Short version of display:
				for (tf in tf2type2pwmEffects) {
					if (tf2type2pwmEffects[tf]["direct"].length > 0) {
						var currTFdiv = document.createElement('div');
						currTFdiv.className = "dataBox";
						allTFsDiv.appendChild(currTFdiv);
					
						var currTitle = document.createElement('div');
						currTFdiv.appendChild(currTitle);
						currTitle.innerHTML = "<h3>" + tf + "</h3>";

						pwmAttribs = tf2type2pwmEffects[tf]["direct"][0];
						makePWMattribsDiv(currTFdiv, pwmAttribs);
					}
				}
			} else {
				// Display the motifs grouped according to TF, with two accordion
				// buttons for each TF; one for direct and one for indirect...
				for (tf in tf2type2pwmEffects) {
					var currTFdiv = document.createElement('div');
					currTFdiv.className = "dataBox";
					allTFsDiv.appendChild(currTFdiv)
				
					var currTitle = document.createElement('div');
					currTFdiv.appendChild(currTitle);
					currTitle.innerHTML = "<h3>" + tf + "</h3>";
	
					var directPWMsdiv = document.createElement('div');
					currTFdiv.appendChild(directPWMsdiv);
					if (tf2type2pwmEffects[tf]["direct"].length > 0) {
						directPWMsdiv.setAttribute("class", "accordion");
						var currTFdirectTitle = document.createElement('h4');
						directPWMsdiv.appendChild(currTFdirectTitle);
						currTFdirectTitle.innerHTML = "Top PWMs. Click to show/hide."
						currTFdirectTitle.className = "clickable";
						var currTFdirectDisplay = document.createElement('div');
	 					directPWMsdiv.appendChild(currTFdirectDisplay);
						for (var pwmIdx = 0; pwmIdx < tf2type2pwmEffects[tf]["direct"].length; pwmIdx++) {
							pwmAttribs = tf2type2pwmEffects[tf]["direct"][pwmIdx];
							makePWMattribsDiv(currTFdirectDisplay, pwmAttribs);
						}
					} else {
						directPWMsdiv.innerHTML = "No top PWMs.";
					}
	
					var indirectPWMsdiv = document.createElement('div');
					currTFdiv.appendChild(indirectPWMsdiv);
					if (tf2type2pwmEffects[tf]["indirect"].length > 0) {
						indirectPWMsdiv.setAttribute("class", "accordion");
						var currTFindirectTitle = document.createElement('h4');
						indirectPWMsdiv.appendChild(currTFindirectTitle);
						currTFindirectTitle.innerHTML = "Auxilliary PWMs. Click to show/hide."
						currTFindirectTitle.className = "clickable";
						var currTFindirectDisplay = document.createElement('div');
	 					indirectPWMsdiv.appendChild(currTFindirectDisplay);
						for (var pwmIdx = 0; pwmIdx < tf2type2pwmEffects[tf]["indirect"].length; pwmIdx++) {
							pwmAttribs = tf2type2pwmEffects[tf]["indirect"][pwmIdx];
							makePWMattribsDiv(currTFindirectDisplay, pwmAttribs);
						}
					} else {
						indirectPWMsdiv.innerHTML = "No auxilliary PWMs.";
					}
				}
			}
			
			// Invoke the accordion behaviour, using the jquery UI script:
			$.getScript("./lib/jquery-ui-1.11.0/jquery-ui.min.js", function(){
				$(function() {
					$( ".accordion" ).accordion({collapsible: true, active: false});
				});
			});
		}
	}
}


// Refactored on October 9th 2014: Code for generating SNP annotation page
// is in here, rather than in singleSNPvis.html
function makeSNPannotPage(snpAnnot) {
	document.title = "SNP annotation: " + snpAnnot.snv.name;

	console.log("Running makeVis()...");
		
	var shortVersion = false;
		
	var snpAnnotDiv = document.createElement('div');
	snpAnnotDiv.className = "titleDiv";
		
	if (shortVersion) {
		snpAnnotDiv.className += " borderless";
	}

	// Retrieve dictionary mapping motif name to tf name; required for displaying
	// the pwm info (added on August 4th 2014). Doing this asynchronous data
	// retrieval here, rather than doing it from the parent window(s):
	motif2tfURL = "./resources/motif2tf.json";
	$.when($.getJSON(motif2tfURL)).then(function(motif2tfJSON) {
		snpAnnot.makeVis(snpAnnotDiv, motif2tfJSON, shortVersion);
		document.body.appendChild(snpAnnotDiv);
	});
}


// Hacky function; examines the PWM name to see if it's likely to be a direct or an
// indirect mode of binding.
function testIfDirect(pwmName) {
	var nameToks = pwmName.split("/");
	var isDirect = false;
	if (nameToks[0] != "chipseq") {
		isDirect = true;
	}

	finalTokSplit = nameToks[nameToks.length-1].split("_");
	if (finalTokSplit[finalTokSplit.length-1] == "Motif1") {
		isDirect = true;
	}
	
	return isDirect;
}


function groupPWMeffects(affectedPWMs, motif2tfs) {
	function comparePWMeffects(pwmEff1, pwmEff2) {
		if (pwmEff1.bestAlleleScore < pwmEff2.bestAlleleScore) {
			return 1;
		} else if (pwmEff1.bestAlleleScore == pwmEff2.bestAlleleScore) {
			return 0;
		} else {
			return -1;
		}
	}

	affectedPWMs.sort(comparePWMeffects);
	tf2type2pwmEffects = {}
	for (var pwmIdx = 0; pwmIdx < affectedPWMs.length; pwmIdx++) {
		pwmAttribs = affectedPWMs[pwmIdx];
		var pwmName = pwmAttribs['motifName'];

		// Retrieve TF name for the motif, from the passed-in JSON object:
		var tfs = motif2tfs[pwmName];
		
		// Changed: October 6th 2014:
		// If matched ChIP-seq peaks are available, then set tfs from
		// that information instead:
		if (pwmAttribs['matchedPeaks'].length > 0) {
			var tfsDict = {};
			for (var peakIdx = 0; peakIdx < pwmAttribs['matchedPeaks'].length; peakIdx++) {
				currPeak = pwmAttribs['matchedPeaks'][peakIdx];
				currTF = currPeak[0].split("|")[2];
				tfsDict[currTF] = 1;
			}
			tfs = Object.keys(tfsDict);
		}

		// Hack: Figure out whether the motif is likely to represent a "direct" mode
		// of binding, by looking at the name of the motif...
		var motifIsDirect = testIfDirect(pwmName);
		var motifType = "indirect";
		if (motifIsDirect) {
			motifType = "direct";
		}

		for (var tfIdx = 0; tfIdx < tfs.length; tfIdx++) {
			var tf = tfs[tfIdx];
			if (!(tf in tf2type2pwmEffects)) {
				tf2type2pwmEffects[tf] = {}
				tf2type2pwmEffects[tf]["direct"] = [];
				tf2type2pwmEffects[tf]["indirect"] = [];
			}

			if (motifType == "direct") {
				tf2type2pwmEffects[tf]["direct"].push(pwmAttribs);
			} else {
				tf2type2pwmEffects[tf]["indirect"].push(pwmAttribs);
			}
		}
	}
	
	return tf2type2pwmEffects;
}


function makePWMattribsDiv(parentElement, pwmAttribs) {
	var currPWMdiv = document.createElement('div');
	currPWMdiv.className = "pwmDiv";

	// Div showing the name, followed by a div showing the PWM match sequence
	// and PWM info:
	var nameDiv = document.createElement('div');
	nameDiv.className = "pwmName";
	pwmName = pwmAttribs.motifName;
	nameDiv.innerHTML = pwmName;
	var displayDiv = document.createElement('div');
	var pwmTable = document.createElement('table');
	displayDiv.appendChild(pwmTable);
	currPWMdiv.appendChild(nameDiv);
	currPWMdiv.appendChild(displayDiv);

	// Fill in contents of the (one-row, two-column) display table:
	var onlyRow = document.createElement('tr');
	pwmTable.appendChild(onlyRow);
	var col1 = document.createElement('td');
	var col2 = document.createElement('td');
	var pwmImg = document.createElement('img');

	// FIXME: HACK: Figuring out the name of the sequence logo
	// from the name of the motif and my png sequence logo filenaming
	// convention:
	pwmImg.src = './resources/seqlogos/' + pwmAttribs.motifName + '_fw_ic0.png';
	if (pwmAttribs.bestHitStrand == "-") {
		pwmImg.src = './resources/seqlogos/' + pwmAttribs.motifName + '_rc_ic0.png';
	}

	pwmImg.height = "45";

	// Hacky: Scaling pwm image based on sequence length:
	pwmImg.width = pwmAttribs.bestHitSeq.length*13;
	col1.appendChild(pwmImg);

	// Calculate which part of the best-allele genomic sequence should be shown in bold:
	var snpPos = pwmAttribs.pos - pwmAttribs.bestHitStart;
	var endOfBoldPos = snpPos + pwmAttribs.bestAlleleSeq.length;
	if (snpPos < 0) {
		// This can happen with insertion/deletion SNPs:
		snpPos = 0;
	}
	var refAlleleLen = pwmAttribs.refAlleleSeq.length;
	var seqToDisplay = pwmAttribs.bestHitSeq.substr(0,snpPos) + '<b>' +	
		pwmAttribs.bestHitSeq.substr(snpPos, endOfBoldPos-snpPos) + 
		'</b>' + pwmAttribs.bestHitSeq.substr(endOfBoldPos, pwmAttribs.bestHitSeq.length-endOfBoldPos);

	//console.log("TRACE:");
	//console.log(pwmAttribs);
	//console.log(seqToDisplay);

	col1.innerHTML = col1.innerHTML + "</br><div class =\"dnaSeq bigText smallGap\">" +
		seqToDisplay + "</div>";
	onlyRow.appendChild(col1);
				
	// FIXME: Currently, I'm assuming that the score has been specified
	// as a -log10(p-value); reversing this calculation to get the p-value:
	var bestP = Math.pow(10, -pwmAttribs.bestAlleleScore);
	var worstP = Math.pow(10, -pwmAttribs.worstAlleleScore);
				
	col2.innerHTML = "Best allele: " + pwmAttribs.bestAlleleSeq +
		" (<i>p</i> = " + bestP.toExponential(3) + ")<br>Worst allele: " +
		pwmAttribs.worstAlleleSeq + " (<i>p</i> = " + worstP.toExponential(3) + ")";
	onlyRow.appendChild(col2);

	parentElement.appendChild(currPWMdiv);	
}