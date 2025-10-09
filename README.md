# Tdarr Radarr/Sonarr Rename Trigger Plugin

A Tdarr post-processing plugin that automatically triggers Radarr or Sonarr to rename media files after transcoding is complete.

## Features

- 🎬 **Radarr Support**: Automatically rename movies after transcoding
- 📺 **Sonarr Support**: Automatically rename TV series episodes after transcoding
- 🔍 **Smart Detection**: Path-based detection with configurable path matching
- 🎯 **Accurate Lookup**: Primary lookup by exact file path, fallback to IMDB/TMDB/TVDB IDs
- ⚙️ **Flexible Configuration**: Enable/disable services independently with custom path filters
- 🔄 **Optional Refresh**: Trigger refresh before rename to ensure new files are detected
- 📝 **Detailed Logging**: Comprehensive logs for debugging and monitoring

## Installation

1. Copy `Tdarr_Plugin_rovey_arr_rename_trigger.js` to your Tdarr plugins directory:
   - **Docker**: `/app/server/Tdarr/Plugins/Local/`
   - **Windows**: `C:\ProgramData\Tdarr\Plugins\Local\`
   - **Linux**: `/opt/tdarr/Plugins/Local/` or `~/.config/Tdarr/Plugins/Local/`

2. Restart Tdarr or reload plugins

3. The plugin will automatically install its dependencies (`sync-request`)

## Configuration

### Plugin Inputs

#### Radarr Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `radarr_enabled` | Boolean | `true` | Enable Radarr processing |
| `radarr_path_contains` | String | `/movies/` | Path must contain this string to trigger Radarr |
| `radarr_host` | String | `http://localhost:7878` | Full URL to your Radarr instance |
| `radarr_api_key` | String | *(empty)* | API Key for Radarr |

#### Sonarr Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `sonarr_enabled` | Boolean | `true` | Enable Sonarr processing |
| `sonarr_path_contains` | String | `/tv/` | Path must contain this string to trigger Sonarr |
| `sonarr_host` | String | `http://localhost:8989` | Full URL to your Sonarr instance |
| `sonarr_api_key` | String | *(empty)* | API Key for Sonarr |

#### Shared Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `refresh_first` | Boolean | `true` | Trigger refresh before renaming to ensure new file is detected |

## Usage

### In Tdarr Flow

1. Add the plugin as a **Post-processing** step in your Tdarr Flow
2. Configure the plugin settings:
   - Set your Radarr/Sonarr host URLs
   - Add your API keys
   - Configure path matching strings (e.g., `/movies/`, `/tv/`, `/media/films/`)
3. Enable/disable Radarr or Sonarr based on your needs

### Example Configurations

#### Separate Movie and TV Libraries

```
Radarr:
  - Enabled: true
  - Path Contains: /movies/
  - Host: http://192.168.1.100:7878
  - API Key: your_radarr_api_key

Sonarr:
  - Enabled: true
  - Path Contains: /tv/
  - Host: http://192.168.1.100:8989
  - API Key: your_sonarr_api_key
```

#### Only Movies (Sonarr Disabled)

```
Radarr:
  - Enabled: true
  - Path Contains: /media/
  - Host: http://localhost:7878
  - API Key: your_radarr_api_key

Sonarr:
  - Enabled: false
```

#### Custom Paths

```
Radarr:
  - Enabled: true
  - Path Contains: /mnt/storage/films/
  
Sonarr:
  - Enabled: true
  - Path Contains: /mnt/storage/series/
```

## How It Works

### Processing Flow

1. **Path Detection**: Checks if file path contains configured strings
2. **Service Selection**: Enables Radarr/Sonarr based on path matching
3. **File Lookup**: 
   - **Primary**: Searches for exact file path match in Radarr/Sonarr
   - **Fallback**: Uses IMDB/TMDB/TVDB ID extracted from path
4. **Refresh** (optional): Triggers media refresh in Radarr/Sonarr
5. **Rename**: Triggers rename command with correct file naming

### ID Detection

The plugin automatically extracts IDs from file paths:

- **IMDB**: `tt1234567` → `{imdb-tt1234567}`
- **TMDB**: `tmdb-12345` or `tmdbid-12345` → `{tmdb-12345}`
- **TVDB**: `tvdb-12345` or `tvdbid-12345` → `{tvdb-12345}`

### API Commands Used

**Radarr (v3 API):**
- `GET /api/v3/movie` - List all movies
- `POST /api/v3/command` with `RefreshMovie` - Refresh movie metadata
- `POST /api/v3/command` with `RenameMovie` - Trigger file rename

**Sonarr (v3 API):**
- `GET /api/v3/series` - List all series
- `GET /api/v3/episodefile?seriesId=X` - Get episode files for series
- `POST /api/v3/command` with `RefreshSeries` - Refresh series metadata
- `POST /api/v3/command` with `RenameSeries` - Trigger file rename

## Example Log Output

### Successful Radarr Rename

```
[RenameTrigger] Path: /data/media/movies/K3 The Ice Princess (2006) {imdb-tt0812265}/K3 The Ice Princess (2006).mkv
[RenameTrigger] Path contains '/movies/' → Using Radarr
[RenameTrigger] Detected IDs → imdb:tt0812265 tmdb:- tvdb:-
[RenameTrigger] Processing with Radarr at http://172.28.10.12:7878
[RenameTrigger] Looking up movie by file path...
[RenameTrigger] Found movie by file path: K3 The Ice Princess (id=42)
[RenameTrigger] Using movie: K3 The Ice Princess (id=42)
[RenameTrigger] Triggering RefreshMovie...
[RenameTrigger] RefreshMovie response: 201
[RenameTrigger] Triggering RenameMovie...
[RenameTrigger] RenameMovie response: 201
[RenameTrigger] ✓ Radarr rename command sent successfully!
```

### Successful Sonarr Rename

```
[RenameTrigger] Path: /data/media/tv/Invincible (2021) {imdb-tt6741278}/Season 01/Invincible (2021) - S01E05.mkv
[RenameTrigger] Path contains '/tv/' → Using Sonarr
[RenameTrigger] Detected IDs → imdb:tt6741278 tmdb:- tvdb:-
[RenameTrigger] Processing with Sonarr at http://172.28.10.4:8989
[RenameTrigger] Looking up series by episode file path...
[RenameTrigger] Found series by episode file path: Invincible (id=23)
[RenameTrigger] Using series: Invincible (id=23)
[RenameTrigger] Triggering RefreshSeries...
[RenameTrigger] RefreshSeries response: 201
[RenameTrigger] Triggering RenameSeries...
[RenameTrigger] RenameSeries response: 201
[RenameTrigger] ✓ Sonarr rename command sent successfully!
```

## Requirements

- **Tdarr**: v2.x or later
- **Radarr**: v3 API (Radarr v3.0.0+)
- **Sonarr**: v3 API (Sonarr v3.0.0+)
- **Node.js**: v14+ (bundled with Tdarr)

## Troubleshooting

### Plugin Not Triggering

- Check that path contains the configured string (case-insensitive)
- Verify service is enabled in plugin settings
- Check Tdarr logs for path detection messages

### Movie/Series Not Found

- Ensure file path exactly matches the path in Radarr/Sonarr
- Verify IMDB/TMDB/TVDB ID is correctly formatted in path
- Check that movie/series exists in Radarr/Sonarr
- Review plugin logs for detailed error messages

### API Errors

- Verify host URL is accessible from Tdarr container/server
- Check API key is correct and has proper permissions
- Ensure Radarr/Sonarr v3 API is being used (not v1/v2)
- Check Radarr/Sonarr logs for API request errors

### Files Not Actually Renamed

- Enable `refresh_first` option to ensure new file is detected
- Manually trigger refresh in Radarr/Sonarr to verify file is recognized
- Check Radarr/Sonarr rename preview to see if rename would occur
- Verify naming scheme is configured in Radarr/Sonarr settings

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**Rovey**

## Acknowledgments

- Built for use with [Tdarr](https://tdarr.io/)
- Integrates with [Radarr](https://radarr.video/) and [Sonarr](https://sonarr.tv/)
- Uses [sync-request](https://www.npmjs.com/package/sync-request) for synchronous HTTP calls

## Version History

### 1.0.0 (2025-10-09)
- Initial release
- Path-based Radarr/Sonarr detection
- File path lookup with ID fallback
- Support for IMDB, TMDB, and TVDB IDs
- Independent enable/disable toggles
- Configurable path matching
- Optional refresh before rename
