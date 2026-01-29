# Trace Explorer

A web application for exploring Global Nature Watch conversation traces with AI-powered analysis using Google Gemini Flash.

## Features

- **AI-Powered Analysis**: Analyzes traces across 5 categories:
  - Showcase (most impactful examples)
  - Product Features
  - Research Areas
  - Dataset Priorities
  - WRI Program Connections

- **Interactive UI**: Click on score badges and interest keywords to navigate to detailed analysis
- **Translation**: Translate non-English traces to English
- **WRI Connections**: Links traces to WRI's public work with verified URLs via Google Search

## Requirements

- Python 3.10 or higher
- Google AI API key (Gemini)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/craigmmills/trace-help.git
   cd trace-help
   ```

2. **Create a virtual environment**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**

   Create a `.env` file in the project root:
   ```bash
   GOOGLE_API_KEY=your_google_api_key_here
   ```

5. **Get a Google API Key**
   - Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Sign in with your Google account
   - Click "Create API Key"
   - Copy the key and add it to your `.env` file

## Adding Trace Data

Place your trace data CSV file in the project root directory. The CSV should have the following columns:

- `trace_id` - Unique identifier for the trace
- `user_message` - The user's message/query
- `assistant_response` - The assistant's response
- `detected_language` - Language code (e.g., "en", "es", "pt")

Update the `CSV_FILE` path in `app.py` if your file has a different name.

## Running the Application

1. **Activate the virtual environment** (if not already active)
   ```bash
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Start the server**
   ```bash
   python app.py
   ```

3. **Open in browser**

   Navigate to [http://localhost:5001](http://localhost:5001)

## Usage

### Main Interface

- **Left Sidebar**: Filter traces by analysis category (Showcase, Product Features, etc.)
- **Middle Panel**: Scrollable list of traces with interest summaries and score badges
- **Right Panel**: Detailed view of selected trace with full analysis

### Navigation

- Click any **score badge** (High/Medium/Low) to jump to that analysis section
- Click **interest keywords** in the summary to navigate to the corresponding analysis
- Use the **Translate to English** button for non-English traces

### Analysis Categories

Each trace is analyzed for:
- **Showcase**: Whether it demonstrates impactful real-world use
- **Product Features**: Requested features or improvements
- **Research Areas**: Scientific research opportunities
- **Dataset Priorities**: Data needs and gaps
- **WRI Programs**: Connections to WRI's work (with verified URLs)

## Troubleshooting

**Port 5001 in use**: Edit `app.py` and change the port number in the last line

**API Key errors**: Ensure your `.env` file exists and contains a valid `GOOGLE_API_KEY`

**CSV loading errors**: Check that your CSV file path is correct in `app.py`

## License

Internal WRI tool - not for public distribution.
