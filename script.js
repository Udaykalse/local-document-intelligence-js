// Main application controller
class DocumentIntelligenceApp {
    constructor() {
        this.currentFile = null;
        this.extractedText = '';
        this.summary = '';
        this.keywords = [];
        this.sentences = [];
        this.stopwords = new Set(STOPWORDS); // From stopwords.js
        
        this.initializeEventListeners();
        this.setTheme(localStorage.getItem('theme') || 'light');
    }

    // Initialize all event listeners
    initializeEventListeners() {
        // File upload handling
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const uploadButton = document.getElementById('uploadButton');
        const analyzeButton = document.getElementById('analyzeButton');
        
        uploadButton.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Drag and drop handling
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            if (e.dataTransfer.files.length) {
                this.handleFile(e.dataTransfer.files[0]);
            }
        });
        
        analyzeButton.addEventListener('click', () => this.analyzeDocument());
        
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        
        // Q&A handling
        document.getElementById('askButton').addEventListener('click', () => this.answerQuestion());
        document.getElementById('questionInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.answerQuestion();
        });
    }

    // Handle file selection from input
    handleFileSelect(event) {
        if (event.target.files.length) {
            this.handleFile(event.target.files[0]);
        }
    }

    // Process the selected file
    handleFile(file) {
        // Validate file type
        const fileType = file.name.split('.').pop().toLowerCase();
        if (!['txt', 'pdf'].includes(fileType)) {
            alert('Please select a .txt or .pdf file');
            return;
        }
        
        this.currentFile = file;
        
        // Update UI to show file info
        document.getElementById('fileName').textContent = file.name;
        document.getElementById('fileInfo').style.display = 'block';
        
        // Clear previous results
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('textPreview').textContent = '';
        document.getElementById('summaryContent').textContent = '';
        document.getElementById('keywordsContent').innerHTML = '';
        document.getElementById('answerContent').textContent = '';
    }

    // Show loading indicator
    showLoading() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    // Hide loading indicator
    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    // Main analysis function
    async analyzeDocument() {
        if (!this.currentFile) {
            alert('Please select a file first');
            return;
        }
        
        this.showLoading();
        
        try {
            // Extract text based on file type
            if (this.currentFile.name.endsWith('.txt')) {
                this.extractedText = await this.extractTextFromTxt(this.currentFile);
            } else if (this.currentFile.name.endsWith('.pdf')) {
                this.extractedText = await this.extractTextFromPdf(this.currentFile);
            }
            
            // Update document preview
            document.getElementById('textPreview').textContent = this.extractedText;
            
            // Process the text
            this.sentences = this.splitIntoSentences(this.extractedText);
            this.summary = this.generateSummary(this.extractedText);
            this.keywords = this.extractKeywords(this.extractedText);
            
            // Update UI with results
            this.displayResults();
            
            // Show results section
            document.getElementById('resultsSection').style.display = 'block';
            
        } catch (error) {
            console.error('Error analyzing document:', error);
            alert('Error processing document. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    // Extract text from TXT file
    extractTextFromTxt(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    // Extract text from PDF file using PDF.js
    async extractTextFromPdf(file) {
        return new Promise((resolve, reject) => {
            const fileReader = new FileReader();
            
            fileReader.onload = async function() {
                try {
                    const typedarray = new Uint8Array(this.result);
                    
                    // Load the PDF document
                    const pdf = await pdfjsLib.getDocument(typedarray).promise;
                    
                    let fullText = '';
                    
                    // Extract text from each page
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map(item => item.str).join(' ');
                        fullText += pageText + '\n';
                    }
                    
                    resolve(fullText);
                } catch (error) {
                    reject(error);
                }
            };
            
            fileReader.onerror = (error) => reject(error);
            fileReader.readAsArrayBuffer(file);
        });
    }

    // Split text into sentences using compromise.js
    splitIntoSentences(text) {
        const doc = nlp(text);
        return doc.sentences().out('array');
    }

    // Generate summary using word frequency heuristic
    generateSummary(text, maxSentences = 5) {
        if (!text.trim()) return '';
        
        // Split into sentences
        const sentences = this.splitIntoSentences(text);
        if (sentences.length <= maxSentences) {
            return sentences.join(' ');
        }
        
        // Calculate word frequencies
        const wordFrequencies = this.calculateWordFrequencies(text);
        
        // Score sentences based on word frequencies
        const sentenceScores = sentences.map(sentence => {
            const words = this.tokenizeText(sentence);
            let score = 0;
            
            words.forEach(word => {
                if (wordFrequencies[word]) {
                    score += wordFrequencies[word];
                }
            });
            
            return {
                sentence,
                score: score / words.length || 0 // Normalize by sentence length
            };
        });
        
        // Sort sentences by score and take top ones
        const topSentences = sentenceScores
            .sort((a, b) => b.score - a.score)
            .slice(0, maxSentences)
            .sort((a, b) => 
                sentences.indexOf(a.sentence) - sentences.indexOf(b.sentence)
            );
        
        return topSentences.map(s => s.sentence).join(' ');
    }

    // Calculate word frequencies for a given text
    calculateWordFrequencies(text) {
        const words = this.tokenizeText(text);
        const frequencies = {};
        
        words.forEach(word => {
            if (!this.stopwords.has(word.toLowerCase()) && word.length > 2) {
                frequencies[word] = (frequencies[word] || 0) + 1;
            }
        });
        
        return frequencies;
    }

    // Extract keywords from text
    extractKeywords(text, maxKeywords = 15) {
        const wordFrequencies = this.calculateWordFrequencies(text);
        
        // Sort by frequency and get top keywords
        return Object.entries(wordFrequencies)
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxKeywords)
            .map(([word]) => word);
    }

    // Tokenize text into words
    tokenizeText(text) {
        const doc = nlp(text);
        return doc.terms().out('array')
            .map(term => term.toLowerCase().replace(/[^\w]/g, ''))
            .filter(term => term.length > 0);
    }

    // Display analysis results in UI
    displayResults() {
        // Display summary
        document.getElementById('summaryContent').textContent = this.summary;
        
        // Display keywords
        const keywordsContainer = document.getElementById('keywordsContent');
        keywordsContainer.innerHTML = '';
        
        this.keywords.forEach(keyword => {
            const keywordElement = document.createElement('span');
            keywordElement.className = 'keyword';
            keywordElement.textContent = keyword;
            keywordsContainer.appendChild(keywordElement);
        });
    }

    // Answer question based on document content
    answerQuestion() {
        const questionInput = document.getElementById('questionInput');
        const question = questionInput.value.trim();
        
        if (!question) {
            alert('Please enter a question');
            return;
        }
        
        if (!this.extractedText) {
            alert('Please analyze a document first');
            return;
        }
        
        const answer = this.findAnswer(question);
        document.getElementById('answerContent').textContent = answer;
    }

    // Find answer to question in document
    findAnswer(question) {
        // Extract keywords from question
        const questionKeywords = this.tokenizeText(question)
            .filter(word => !this.stopwords.has(word) && word.length > 2);
        
        if (questionKeywords.length === 0) {
            return "I couldn't identify any meaningful keywords in your question. Please try rephrasing.";
        }
        
        // Score sentences based on keyword matches
        const sentenceScores = this.sentences.map(sentence => {
            const sentenceWords = this.tokenizeText(sentence);
            let score = 0;
            
            questionKeywords.forEach(keyword => {
                if (sentenceWords.includes(keyword)) {
                    score += 1;
                }
            });
            
            return {
                sentence,
                score
            };
        });
        
        // Find the sentence with the highest score
        const bestMatch = sentenceScores.reduce((best, current) => 
            current.score > best.score ? current : best, 
            { sentence: '', score: 0 }
        );
        
        if (bestMatch.score === 0) {
            return "I couldn't find a relevant answer to your question in the document.";
        }
        
        return bestMatch.sentence;
    }

    // Theme management
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        const themeButton = document.getElementById('themeToggle');
        themeButton.textContent = theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode';
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DocumentIntelligenceApp();
});