
        let map;
        let markers = [];
        let isLocationSearch = false;

        window.onload = function() {
            initMap();
            document.getElementById('map').style.display = 'none';
            document.getElementById('mapSearchMessage').style.display = 'none';
        };

        function initMap() {
            if (!map) {
                map = L.map('map').setView([0, 0], 2);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors'
                }).addTo(map);

                map.on('click', function(e) {
                    if (isLocationSearch) {
                        performLocationSearch(e.latlng.lat, e.latlng.lng);
                    }
                });
            }
        }

        function searchByLocation() {
            const mapDiv = document.getElementById('map');
            const messageDiv = document.getElementById('mapSearchMessage');
            
            mapDiv.style.display = 'block';
            messageDiv.style.display = 'block';
            
            if (!map) {
                initMap();
            }
            
            isLocationSearch = true;
            clearMarkers();
            
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(function(position) {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    map.setView([lat, lng], 8);
                    performLocationSearch(lat, lng);
                }, function(error) {
                    console.error("Error getting location:", error);
                    map.setView([0, 0], 2);
                });
            }
        }


        function toggleMap() {
            const mapDiv = document.getElementById('map');
            const messageDiv = document.getElementById('mapSearchMessage');
            
            if (mapDiv.style.display === 'none') {
                mapDiv.style.display = 'block';
                messageDiv.style.display = isLocationSearch ? 'block' : 'none';
                if (!map) {
                    initMap();
                }
                map.invalidateSize();
            } else {
                mapDiv.style.display = 'none';
                messageDiv.style.display = 'none';
            }
        }

        function clearMarkers() {
            if (markers.length > 0) {
                markers.forEach(marker => map.removeLayer(marker));
                markers = [];
            }
        }

        async function performLocationSearch(lat, lng) {
            const gallery = document.getElementById('gallery');
            gallery.innerHTML = '<div class="loading">Searching for media near this location...</div>';
            clearMarkers();

            try {
                const radius = 10; // 10km radius
                const limit = document.getElementById('limit').value;
                
                const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch&ggsnamespace=6&ggscoord=${lat}|${lng}&ggsradius=${radius * 1000}&ggslimit=${limit}&prop=imageinfo|coordinates&iiprop=url|timestamp|size|mime|dimensions|user&iiurlwidth=480&format=json&origin=*`;                
                const response = await fetch(url);
                const data = await response.json();

                if (data.query && data.query.pages) {
                    const results = Object.values(data.query.pages);
                    
                    if (results.length > 0) {
                        displayResults(data.query.pages, document.getElementById('fileType').value, document.getElementById('sortBy').value);
                        displayLocationsOnMap(data.query.pages);
                        
                        // Add search center marker
                        const searchCenterMarker = L.marker([lat, lng], {
                            icon: L.divIcon({
                                className: 'search-center-marker',
                                html: '<i class="fas fa-search"></i>',
                                iconSize: [20, 20]
                            })
                        }).addTo(map);
                        markers.push(searchCenterMarker);

                        // Fit map to show all results
                        const group = new L.featureGroup(markers);
                        map.fitBounds(group.getBounds().pad(0.1));
                        
                        // Show success message with timeout
                        showTemporaryMessage(`Found ${results.length} results near this location`, 'success');
                    } else {
                        // Show error message with timeout
                        showTemporaryMessage('No media files found in this area. Try increasing the search radius.', 'error');
                    }
                } else {
                    gallery.innerHTML = '<div class="error-message">No results found in this area. Try a different location.</div>';
                }
            } catch (error) {
                console.error('Error fetching results:', error);
                gallery.innerHTML = '<div class="error-message">Error fetching results. Please try again.</div>';
            }
        }

        async function performSearch() {
            const searchTerm = document.getElementById('searchInput').value.trim();
            if (!searchTerm) {
                alert('Please enter a search term');
                return;
            }

            const gallery = document.getElementById('gallery');
            gallery.innerHTML = '<div class="loading">Searching...</div>';

            try {
                const limit = document.getElementById('limit').value;
                const fileType = document.getElementById('fileType').value;
                
                // Modify the search query based on file type
                let fileTypeQuery = '';
                if (fileType === 'all') {
                    fileTypeQuery = 'filetype:bitmap|drawing|image|video|audio|multimedia';
                } else if (fileType === 'video') {
                    fileTypeQuery = 'filetype:video|multimedia';
                } else if (fileType === 'image') {
                    fileTypeQuery = 'filetype:bitmap|drawing|image';
                } else {
                    fileTypeQuery = 'filetype:audio|office|pdf|text';
                }

                const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${fileTypeQuery} ${encodeURIComponent(searchTerm)}&gsrlimit=${limit}&prop=imageinfo|coordinates&iiprop=url|timestamp|size|mime|mediatype|thumburl|metadata&iiurlwidth=480&format=json&origin=*`;
                
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.query && data.query.pages) {
                    displayResults(data.query.pages, fileType, document.getElementById('sortBy').value);
                    if (map && document.getElementById('map').style.display !== 'none') {
                        displayLocationsOnMap(data.query.pages);
                    }
                } else {
                    gallery.innerHTML = '<div class="error-message">No results found.</div>';
                }
            } catch (error) {
                console.error('Error fetching results:', error);
                gallery.innerHTML = '<div class="error-message">Error fetching results. Please try again.</div>';
            }
        }

        function displayLocationsOnMap(results) {
    clearMarkers();
    
    Object.values(results).forEach(item => {
        if (item.coordinates && item.coordinates[0] && item.imageinfo && item.imageinfo[0]) {
            const lat = item.coordinates[0].lat;
            const lon = item.coordinates[0].lon;
            const imageInfo = item.imageinfo[0];

            const marker = L.marker([lat, lon]).addTo(map);
            
            let popupContent = `
            <div class="location-marker">
                <h4>${item.title.replace('File:', '')}</h4>
                <img src="${imageInfo.thumburl || imageInfo.url}" alt="${item.title}" style="width: 100%; border-radius: 4px; margin-top: 0.5rem;">
                <p>Date: ${new Date(imageInfo.timestamp).toLocaleDateString()}</p>
                <button onclick="openModal('${imageInfo.url}', '${item.title}', ${JSON.stringify(imageInfo).replace(/"/g, '&quot;')})" class="action-btn">
                    <i class="fas fa-info-circle"></i> View Details
                </button>
            </div>
        `;

            const popup = L.popup().setContent(popupContent);
            marker.bindPopup(popup);
            markers.push(marker);
        }
    });

    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

        function displayResults(results, fileType, sortBy) {
            const gallery = document.getElementById('gallery');
            gallery.innerHTML = '';

            if (!results || Object.keys(results).length === 0) {
                gallery.innerHTML = '<div class="error-message">No results found.</div>';
                return;
            }

            let items = Object.values(results).filter(item => item.imageinfo && item.imageinfo[0]);

            items.sort((a, b) => {
                switch (sortBy) {
                    case 'date':
                        return new Date(b.imageinfo[0].timestamp) - new Date(a.imageinfo[0].timestamp);
                    case 'size':
                        return b.imageinfo[0].size - a.imageinfo[0].size;
                    default:
                        return 0;
                }
            });

            items.forEach(item => {
                const imageInfo = item.imageinfo[0];
                const mimeType = imageInfo.mime;

                if (fileType !== 'all') {
                    if (fileType === 'image' && !mimeType.startsWith('image/')) return;
                    if (fileType === 'video' && !mimeType.startsWith('video/')) return;
                    if (fileType === 'other' && (mimeType.startsWith('image/') || mimeType.startsWith('video/'))) return;
                }

                const element = document.createElement('div');
                element.className = 'gallery-item';

                element.onclick = function() {
                    openModal(imageInfo.url, item.title, imageInfo);
                };

                let locationInfo = '';
                if (item.coordinates && item.coordinates[0]) {
                    const lat = item.coordinates[0].lat;
                    const lon = item.coordinates[0].lon;
                    locationInfo = `
                        <span class="metadata">
                            <i class="fas fa-map-marker-alt"></i> ${lat.toFixed(4)}, ${lon.toFixed(4)}
                        </span>
                    `;
                }

                if (mimeType.startsWith('image/')) {
                    element.innerHTML = `
                        <img src="${imageInfo.url}" alt="${item.title}" loading="lazy">
                        <div class="info">
                            <p class="title">${item.title.replace('File:', '')}</p>
                            <div class="metadata">
                                <span><i class="fas fa-file-image"></i> ${mimeType.split('/')[1].toUpperCase()}</span>
                                <span><i class="fas fa-weight"></i> ${(imageInfo.size / 1024).toFixed(2)} KB</span>
                                <span><i class="fas fa-calendar"></i> ${new Date(imageInfo.timestamp).toLocaleDateString()}</span>
                                ${locationInfo}
                            </div>
                            <a href="${imageInfo.url}" class="download-btn" target="_blank">
                                <i class="fas fa-download"></i> Download
                            </a>
                        </div>
                    `;
                } else if (mimeType.startsWith('video/')) {
                    element.innerHTML = `
                        <video controls poster="${imageInfo.thumburl || ''}" style="width: 100%; height: 250px; object-fit: cover;">
                            <source src="${imageInfo.url}" type="${mimeType}">
                            Your browser does not support the video tag.
                        </video>
                        <div class="info">
                            <p class="title">${item.title.replace('File:', '')}</p>
                            <div class="metadata">
                                <span><i class="fas fa-file-video"></i> ${mimeType.split('/')[1].toUpperCase()}</span>
                                <span><i class="fas fa-weight"></i> ${(imageInfo.size / (1024 * 1024)).toFixed(2)} MB</span>
                                <span><i class="fas fa-calendar"></i> ${new Date(imageInfo.timestamp).toLocaleDateString()}</span>
                                ${locationInfo}
                            </div>
                            <a href="${imageInfo.url}" class="download-btn" target="_blank" download>
                                <i class="fas fa-download"></i> Download
                            </a>
                        </div>
                    `;
                } else if (mimeType.startsWith('audio/')) {
                    element.innerHTML = `
                        <div class="audio-container" style="padding: 20px; display: flex; align-items: center; justify-content: center; height: 250px; background: #f5f5f5;">
                            <audio controls style="width: 100%; max-width: 300px;">
                                <source src="${imageInfo.url}" type="${mimeType}">
                                Your browser does not support the audio element.
                            </audio>
                        </div>
                        <div class="info">
                            <p class="title">${item.title.replace('File:', '')}</p>
                            <div class="metadata">
                                <span><i class="fas fa-file-audio"></i> ${mimeType.split('/')[1].toUpperCase()}</span>
                                <span><i class="fas fa-weight"></i> ${(imageInfo.size / (1024 * 1024)).toFixed(2)} MB</span>
                                <span><i class="fas fa-calendar"></i> ${new Date(imageInfo.timestamp).toLocaleDateString()}</span>
                                ${locationInfo}
                            </div>
                            <a href="${imageInfo.url}" class="download-btn" target="_blank" download>
                                <i class="fas fa-download"></i> Download
                            </a>
                        </div>
                    `;
                } else {
                    element.innerHTML = `
                        <div class="info">
                            <p class="title">${item.title.replace('File:', '')}</p>
                            <div class="metadata">
                                <span><i class="fas fa-file"></i> ${mimeType}</span>
                                <span><i class="fas fa-weight"></i> ${(imageInfo.size / 1024).toFixed(2)} KB</span>
                                <span><i class="fas fa-calendar"></i> ${new Date(imageInfo.timestamp).toLocaleDateString()}</span>
                                ${locationInfo}
                            </div>
                            <a href="${imageInfo.url}" class="download-btn" target="_blank">
                                <i class="fas fa-download"></i> Download
                            </a>
                        </div>
                    `;
                }

                gallery.appendChild(element);
            });
        }

        async function openModal(imageUrl, title, imageInfo) {
            const modal = document.getElementById('imageModal');
            const modalImage = document.getElementById('modalImage');
            const modalDetails = document.getElementById('modalDetails');
            
            modalImage.src = imageUrl;
            modalDetails.innerHTML = '<div class="loading">Loading details...</div>';
            modal.style.display = 'block';

            try {
                const filename = encodeURIComponent(title);
const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${filename}&prop=imageinfo|categories|globalusage|extlinks&iiprop=timestamp|user|url|size|mime|mediatype|metadata|commonmetadata|extmetadata&iiurlwidth=480&format=json&origin=*`;                
                const response = await fetch(wikiUrl);
                const data = await response.json();
                const page = Object.values(data.query.pages)[0];
                const extMetadata = page.imageinfo[0].extmetadata || {};
                const metadata = page.imageinfo[0].metadata || [];

                modalDetails.innerHTML = `
                    <div class="detail-section">
                        <h2><i class="fas fa-file-image"></i> ${title.replace('File:', '')}</h2>
                        
                        

                        <div class="tabs">
                            <button class="tab-btn active" onclick="switchTab(event, 'info')">
                                <i class="fas fa-info-circle"></i> Basic Info
                            </button>
                            <button class="tab-btn" onclick="switchTab(event, 'metadata')">
                                <i class="fas fa-cogs"></i> Technical Data
                            </button>
                            <button class="tab-btn" onclick="switchTab(event, 'usage')">
                                <i class="fas fa-chart-bar"></i> Usage
                            </button>
                        </div>

                        <div id="info" class="tab-content active">
                            <div class="info-grid">
                                <div class="info-card">
                                    <div class="info-icon"><i class="fas fa-user"></i></div>
                                    <div class="info-details">
                                        <h4>Author</h4>
                                        <p>
                                            <button 
                                                onclick="window.open('https://commons.wikimedia.org/wiki/User:${encodeURIComponent(extMetadata.Artist ? extMetadata.Artist.value : 'Unknown')}', '_blank')" 
                                                class="author-link-button">
                                                ${extMetadata.Artist ? extMetadata.Artist.value : 'Unknown'}
                                            </button>
                                        </p>
                                    </div>
                                </div>
                                <div class="info-card">
                                    <div class="info-icon"><i class="fas fa-calendar-alt"></i></div>
                                    <div class="info-details">
                                        <h4>Upload Date</h4>
                                        <p>${new Date(page.imageinfo[0].timestamp).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div class="info-card">
                                    <div class="info-icon"><i class="fas fa-file-alt"></i></div>
                                    <div class="info-details">
                                        <h4>License</h4>
                                        <p>${extMetadata.License ? extMetadata.License.value : 'Unknown'}</p>
                                    </div>
                                </div>
                                <div class="info-card">
                                    <div class="info-icon"><i class="fas fa-expand"></i></div>
                                    <div class="info-details">
                                        <h4>Dimensions</h4>
                                        <p>${page.imageinfo[0].width} × ${page.imageinfo[0].height} pixels</p>
                                    </div>
                                </div>
                            </div>

                            <div class="description-card">
                                <h3><i class="fas fa-align-left"></i> Description</h3>
                                <p>${extMetadata.ImageDescription ? extMetadata.ImageDescription.value : 'No description available'}</p>
                            </div>
                        </div>

                        <div id="metadata" class="tab-content">
                            <div class="metadata-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Property</th>
                                            <th>Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${metadata.map(m => `
                                            <tr>
                                                <td>${m.name}</td>
                                                <td>${m.value}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div id="usage" class="tab-content">
                            <div class="categories-section">
                                <h3><i class="fas fa-tags"></i> Categories</h3>
                                <div class="categories-list">
                                    ${page.categories ? page.categories.map(cat => `
                                        <span class="category-tag">
                                            <i class="fas fa-tag"></i>
                                            ${cat.title.replace('Category:', '')}
                                        </span>
                                    `).join('') : 'No categories available'}
                                </div>
                            </div>
                        </div>

                        <div class="modal-actions">
                            <a href="${page.imageinfo[0].url}" class="action-button primary" target="_blank">
                                <i class="fas fa-download"></i> Download Full Resolution
                            </a>
                            <a href="https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}" class="action-button secondary" target="_blank">
                                <i class="fas fa-external-link-alt"></i> View on Commons
                            </a>
                                <button class="action-btn" onclick="shareMedia('${page.imageinfo[0].url}', '${title}')">
                                <i class="fas fa-share-alt"></i>
                                Share
                            </button>
                        </div>
                    </div>
                `;

                // Add tab switching functionality
                document.querySelectorAll('.tab-btn').forEach(button => {
                    button.addEventListener('click', (e) => {
                        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                        e.target.classList.add('active');
                        document.getElementById(e.target.getAttribute('onclick').match(/'([^']+)'/)[1]).classList.add('active');
                    });
                });
            } catch (error) {
                console.error('Error fetching image details:', error);
                modalDetails.innerHTML = '<div class="error-message">Error loading image details</div>';
            }
        }

        function closeModal() {
            document.getElementById('imageModal').style.display = 'none';
        }

        window.onclick = function(event) {
            const modal = document.getElementById('imageModal');
            if (event.target === modal) {
                closeModal();
            }
        }

        document.getElementById('searchInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });

        function downloadMedia(url, title) {
            // Create a temporary anchor element
            const a = document.createElement('a');
            a.href = url;
            a.download = title.replace('File:', ''); // Set suggested filename
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        function shareMedia(url, title) {
            if (navigator.share) {
                // Use Web Share API if available
                navigator.share({
                    title: title.replace('File:', ''),
                    url: url
                }).catch(console.error);
            } else {
                // Fallback to copying to clipboard
                navigator.clipboard.writeText(url).then(() => {
                    // Show a temporary success message
                    const shareBtn = event.target.closest('.action-btn');
                    const originalText = shareBtn.innerHTML;
                    shareBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    setTimeout(() => {
                        shareBtn.innerHTML = originalText;
                    }, 2000);
                }).catch(console.error);
            }
        }

        function showDetails(title) {
            // Open in new tab on Wikimedia Commons
            window.open(`https://commons.wikimedia.org/wiki/${title}`, '_blank');
        }

        let debounceTimer;
        const searchInput = document.getElementById('searchInput');
        const suggestionsDiv = document.getElementById('searchSuggestions');

        searchInput.addEventListener('input', function(e) {
            clearTimeout(debounceTimer);
            const searchTerm = e.target.value.trim();
            
            if (searchTerm.length < 2) {
                suggestionsDiv.style.display = 'none';
                return;
            }

            debounceTimer = setTimeout(() => {
                fetchSuggestions(searchTerm);
            }, 300);
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', function(e) {
            if (!searchInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
                suggestionsDiv.style.display = 'none';
            }
        });

        async function fetchSuggestions(searchTerm) {
            try {
                const url = `https://commons.wikimedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(searchTerm)}&namespace=6&limit=10&format=json&origin=*`;
                
                const response = await fetch(url);
                const data = await response.json();
                
                displaySuggestions(data[1], searchTerm);
            } catch (error) {
                console.error('Error fetching suggestions:', error);
            }
        }

        function displaySuggestions(suggestions, searchTerm) {
            if (!suggestions || suggestions.length === 0) {
                suggestionsDiv.style.display = 'none';
                return;
            }

            const regex = new RegExp(`(${searchTerm})`, 'gi');
            suggestionsDiv.innerHTML = suggestions
                .map(suggestion => {
                    const highlightedText = suggestion.replace('File:', '')
                        .replace(regex, '<span class="suggestion-highlight">$1</span>');
                    
                    return `
                        <div class="suggestion-item" onclick="selectSuggestion('${suggestion.replace(/'/g, "\\'")}')">
                            <i class="fas fa-search"></i>
                            ${highlightedText}
                        </div>
                    `;
                })
                .join('');

            suggestionsDiv.style.display = 'block';
        }

        function selectSuggestion(suggestion) {
            searchInput.value = suggestion;
            suggestionsDiv.style.display = 'none';
            performSearch();
        }

        // Add keyboard navigation for suggestions
        searchInput.addEventListener('keydown', function(e) {
            const suggestions = suggestionsDiv.getElementsByClassName('suggestion-item');
            const current = suggestionsDiv.querySelector('.suggestion-item.selected');
            
            if (suggestions.length === 0) return;

            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                
                if (!current) {
                    suggestions[e.key === 'ArrowDown' ? 0 : suggestions.length - 1].classList.add('selected');
                    return;
                }

                current.classList.remove('selected');
                let next;

                if (e.key === 'ArrowDown') {
                    next = current.nextElementSibling || suggestions[0];
                } else {
                    next = current.previousElementSibling || suggestions[suggestions.length - 1];
                }

                next.classList.add('selected');
            } else if (e.key === 'Enter' && current) {
                e.preventDefault();
                current.click();
            }
        });

        // Add this helper function before the existing scripts
        function showTemporaryMessage(message, type, duration = 5000) {
            // Remove any existing messages
            const existingMessages = document.querySelectorAll('.success-message, .error-message');
            existingMessages.forEach(msg => msg.remove());

            // Create new message
            const messageDiv = document.createElement('div');
            messageDiv.className = `${type}-message`;
            messageDiv.innerHTML = message;

            // Insert message before gallery
            const gallery = document.getElementById('gallery');
            gallery.insertAdjacentElement('beforebegin', messageDiv);

            // Remove message after duration
            setTimeout(() => {
                messageDiv.style.opacity = '0';
                messageDiv.style.transition = 'opacity 0.5s ease';
                setTimeout(() => messageDiv.remove(), 500);
            }, duration);
        }

//voice search

class VoiceSearch {
    constructor() {
        // Initialize speech recognition
        this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        this.searchInput = document.getElementById('searchInput');
        this.voiceSearchBtn = document.getElementById('voiceSearchBtn');
        this.isListening = false;

        // Configure recognition settings
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = document.getElementById('languageSelect')?.value || 'en-US';

        this.initializeVoiceSearch();
    }

    initializeVoiceSearch() {
        // Handle start of speech recognition
        this.recognition.onstart = () => {
            this.isListening = true;
            this.voiceSearchBtn.classList.add('active');
            this.voiceSearchBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
            // Show visual feedback
            this.showFeedback('Listening...');
        };

        // Handle end of speech recognition
        this.recognition.onend = () => {
            this.isListening = false;
            this.voiceSearchBtn.classList.remove('active');
            this.voiceSearchBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            this.hideFeedback();
        };

        // Handle speech recognition results
        this.recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0])
                .map(result => result.transcript)
                .join('');

            // Update search input in real-time
            this.searchInput.value = transcript;

            // If we have final results, stop listening and perform search
            if (event.results[0].isFinal) {
                this.recognition.stop();
                performSearch(); // Trigger search automatically
            }
        };

        // Handle errors
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.showFeedback(`Error: ${event.error}`, true);
            this.resetVoiceSearch();
        };

        // Add click handler to voice search button
        this.voiceSearchBtn.addEventListener('click', () => {
            if (!this.isListening) {
                this.startListening();
            } else {
                this.stopListening();
            }
        });
    }

    startListening() {
        try {
            this.recognition.start();
        } catch (error) {
            console.error('Failed to start speech recognition:', error);
            this.showFeedback('Could not start voice recognition', true);
        }
    }

    stopListening() {
        try {
            this.recognition.stop();
        } catch (error) {
            console.error('Failed to stop speech recognition:', error);
        }
    }

    resetVoiceSearch() {
        this.isListening = false;
        this.voiceSearchBtn.classList.remove('active');
        this.voiceSearchBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        this.hideFeedback();
    }

    showFeedback(message, isError = false) {
        let feedback = document.getElementById('voiceFeedback');
        if (!feedback) {
            feedback = document.createElement('div');
            feedback.id = 'voiceFeedback';
            document.body.appendChild(feedback);
        }

        feedback.className = `voice-feedback ${isError ? 'error' : ''}`;
        feedback.textContent = message;
        feedback.style.display = 'block';
    }

    hideFeedback() {
        const feedback = document.getElementById('voiceFeedback');
        if (feedback) {
            feedback.style.display = 'none';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const voiceSearch = new VoiceSearch();
});



