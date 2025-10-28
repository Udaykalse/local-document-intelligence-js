class WeatherDashboard {
    constructor() {
        this.apiKey = 'YOUR_API_KEY_HERE'; // Replace with your OpenWeatherMap API key
        this.baseUrl = 'https://api.openweathermap.org/data/2.5';
        this.recentSearches = JSON.parse(localStorage.getItem('recentSearches')) || [];
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadRecentSearches();
    }

    initializeElements() {
        this.cityInput = document.getElementById('city-input');
        this.searchBtn = document.getElementById('search-btn');
        this.currentWeather = document.getElementById('current-weather');
        this.forecastSection = document.getElementById('forecast');
        this.errorMessage = document.getElementById('error-message');
        this.recentSearchesContainer = document.getElementById('recent-searches');
        
        // Current weather elements
        this.cityName = document.getElementById('city-name');
        this.currentTemp = document.getElementById('current-temp');
        this.weatherDescription = document.getElementById('weather-description');
        this.feelsLike = document.getElementById('feels-like');
        this.humidity = document.getElementById('humidity');
        this.windSpeed = document.getElementById('wind-speed');
        this.pressure = document.getElementById('pressure');
        
        // Forecast container
        this.forecastCards = document.getElementById('forecast-cards');
    }

    attachEventListeners() {
        this.searchBtn.addEventListener('click', () => this.searchWeather());
        this.cityInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchWeather();
        });
    }

    async searchWeather() {
        const city = this.cityInput.value.trim();
        if (!city) return;

        try {
            this.hideError();
            await this.fetchWeatherData(city);
            this.addToRecentSearches(city);
            this.cityInput.value = '';
        } catch (error) {
            this.showError();
            console.error('Error fetching weather data:', error);
        }
    }

    async fetchWeatherData(city) {
        // Fetch current weather
        const currentWeatherUrl = `${this.baseUrl}/weather?q=${city}&appid=${this.apiKey}&units=metric`;
        const currentResponse = await fetch(currentWeatherUrl);
        
        if (!currentResponse.ok) {
            throw new Error('City not found');
        }

        const currentData = await currentResponse.json();

        // Fetch 5-day forecast
        const forecastUrl = `${this.baseUrl}/forecast?q=${city}&appid=${this.apiKey}&units=metric`;
        const forecastResponse = await fetch(forecastUrl);
        const forecastData = await forecastResponse.json();

        this.displayCurrentWeather(currentData);
        this.displayForecast(forecastData);
    }

    displayCurrentWeather(data) {
        this.cityName.textContent = `${data.name}, ${data.sys.country}`;
        this.currentTemp.textContent = `${Math.round(data.main.temp)}°C`;
        this.weatherDescription.textContent = data.weather[0].description;
        this.feelsLike.textContent = `${Math.round(data.main.feels_like)}°C`;
        this.humidity.textContent = `${data.main.humidity}%`;
        this.windSpeed.textContent = `${data.wind.speed} m/s`;
        this.pressure.textContent = `${data.main.pressure} hPa`;

        this.showElement(this.currentWeather);
        this.hideElement(this.forecastSection);
    }

    displayForecast(data) {
        this.forecastCards.innerHTML = '';
        
        // Group forecast by day and get one reading per day
        const dailyForecasts = {};
        data.list.forEach(item => {
            const date = new Date(item.dt * 1000).toLocaleDateString();
            if (!dailyForecasts[date]) {
                dailyForecasts[date] = item;
            }
        });

        // Display next 5 days
        Object.values(dailyForecasts).slice(0, 5).forEach(day => {
            const date = new Date(day.dt * 1000);
            const card = this.createForecastCard(day, date);
            this.forecastCards.appendChild(card);
        });

        this.showElement(this.forecastSection);
    }

    createForecastCard(day, date) {
        const card = document.createElement('div');
        card.className = 'forecast-card';
        
        card.innerHTML = `
            <div class="forecast-date">${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
            <div class="forecast-temp">${Math.round(day.main.temp)}°C</div>
            <div class="forecast-desc">${day.weather[0].description}</div>
            <div class="forecast-details">
                <small>Humidity: ${day.main.humidity}%</small>
            </div>
        `;

        return card;
    }

    addToRecentSearches(city) {
        // Remove if already exists
        this.recentSearches = this.recentSearches.filter(item => 
            item.toLowerCase() !== city.toLowerCase()
        );
        
        // Add to beginning
        this.recentSearches.unshift(city);
        
        // Keep only last 5 searches
        this.recentSearches = this.recentSearches.slice(0, 5);
        
        // Save to localStorage
        localStorage.setItem('recentSearches', JSON.stringify(this.recentSearches));
        
        this.loadRecentSearches();
    }

    loadRecentSearches() {
        this.recentSearchesContainer.innerHTML = '';
        
        this.recentSearches.forEach(city => {
            const chip = document.createElement('div');
            chip.className = 'recent-search';
            chip.textContent = city;
            chip.addEventListener('click', () => {
                this.cityInput.value = city;
                this.searchWeather();
            });
            this.recentSearchesContainer.appendChild(chip);
        });
    }

    showElement(element) {
        element.classList.remove('hidden');
    }

    hideElement(element) {
        element.classList.add('hidden');
    }

    showError() {
        this.hideElement(this.currentWeather);
        this.hideElement(this.forecastSection);
        this.showElement(this.errorMessage);
    }

    hideError() {
        this.hideElement(this.errorMessage);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WeatherDashboard();
});