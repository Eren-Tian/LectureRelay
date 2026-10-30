/** Stable native error identities; values only index the legacy/status translation catalog. */
export const nativeErrorKeys: Record<string, string> = {
  notes_are_too_long_shorten_them_before_saving:
    'Notes are too long. Shorten them before saving.',
  cannot_read_notes: 'Cannot read notes.',
  cannot_save_notes: 'Cannot save notes.',
  cannot_read_answers: 'Cannot read answers.',
  cannot_encode_answer_sources: 'Cannot encode answer sources.',
  cannot_save_answers: 'Cannot save answers.',
  the_answer_sources_is_damaged: 'The answer sources is damaged.',
  operation_failed: 'Operation did not complete. Try again.',
  live_translation_preview_superseded: 'Live translation preview superseded.',
  live_translation_queue_unavailable: 'Live translation queue unavailable.',
  type_delete_to_confirm_permanent_deletion:
    'Type DELETE to confirm permanent deletion.',
  type_delete_all_to_confirm_freeing_all_class:
    'Type DELETE ALL to confirm freeing all class storage.',
  cannot_safely_start_local_speech_worker:
    'Cannot safely start local speech worker.',
  stop_and_save_the_recording_before_transcription:
    'Stop and save the recording before transcription.',
  audio_cannot_be_read_the_recording_may_not:
    'Audio cannot be read. The recording may not have completed normally.',
  this_recording_format_is_not_supported_for_transcription:
    'This recording format is not supported for transcription.',
  invalid_transcription_timestamps_or_text_saved_content_is:
    'Invalid transcription timestamps or text. Saved content is preserved.',
  no_english_segments_need_translation: 'No English segments need translation.',
  some_translations_are_missing_english_is_preserved_run:
    'Some translations are missing. English is preserved; run translation again.',
  transcript_or_target_language_changed_old_translations_were:
    'Transcript or target language changed. Old translations were discarded.',
  enter_aquestion_of_no_more_than2:
    'Enter a question of no more than 2,000 characters.',
  split_long_transcript_segments_into_shorter_sections_before:
    'Split long transcript segments into shorter sections before asking a question.',
  choose_asubtitle_language: 'Choose a subtitle language.',
  no_subtitles_are_available_in_this_language:
    'No subtitles are available in this language.',
  another_ai_task_is_running_wait_or_cancel:
    'Another AI task is running. Wait or cancel it.',
  task_cancelled_saved_results_are_preserved:
    'Task cancelled. Saved results are preserved.',
  the_local_pdf_is_missing_or_unreadable:
    'The local PDF is missing or unreadable.',
  choose_avalid_pdf_smaller_than50_mib:
    'Choose a valid PDF smaller than 50 MiB.',
  choose_amedia_file_smaller_than2_gib:
    'Choose a media file smaller than 2 GiB.',
  this_media_format_is_unsupported_or_damaged:
    'This media format is unsupported or damaged.',
  no_supported_audio_track_was_found: 'No supported audio track was found.',
  unknown_audio_sample_rate: 'Unknown audio sample rate.',
  this_audio_codec_is_unsupported: 'This audio codec is unsupported.',
  media_decoding_failed_the_original_file_was_not:
    'Media decoding failed. The original file was not changed.',
  audio_is_damaged_or_uses_an_unsupported_codec:
    'Audio is damaged or uses an unsupported codec.',
  changing_audio_format_is_unsupported: 'Changing audio format is unsupported.',
  media_exceeds_the_five_hour_import_limit:
    'Media exceeds the five-hour import limit.',
  the_selected_file_contains_no_decodable_audio:
    'The selected file contains no decodable audio.',
  the_audio_track_ended_unexpectedly_original_media_is:
    'The audio track ended unexpectedly. Original media is preserved.',
  the_transcript_course_context_language_or_model_changed:
    'The transcript, course context, language or model changed. Saved sections remain available; start a new review to use the current source.',
  keep_review_instructions_under2000_characters:
    'Keep review instructions under 2,000 characters.',
  add_or_generate_atranscript_first: 'Add or generate a transcript first.',
  review_assembly_is_incomplete: 'Review assembly is incomplete.',
  asmall_review_section_still_exceeds_the_model:
    'A small review section still exceeds the model limit. Saved sections are preserved; retry or simplify the requested focus.',
  source_coverage_is_incomplete: 'Source coverage is incomplete.',
  local_ai_reached_its_output_limit_completed_review:
    'Local AI reached its output limit. Completed review sections are saved; retry the remaining work.',
  the_audio_device_reported_adiscontinuity_check_the:
    'The audio device reported a discontinuity. Check the recording; the device did not report how much audio was affected.',
  the_audio_device_returned_an_invalid_format:
    'The audio device returned an invalid format.',
  invalid_audio_device_select_it_again:
    'Invalid audio device. Select it again.',
  this_audio_format_is_unsupported_choose_another_device:
    'This audio format is unsupported. Choose another device.',
  audio_device_disconnected_during_the_test:
    'Audio device disconnected during the test.',
  another_lecture_is_recording_stop_it_first:
    'Another lecture is recording. Stop it first.',
  audio_startup_timed_out_check_the_device_and:
    'Audio startup timed out. Check the device and permissions.',
  this_lecture_is_not_recording: 'This lecture is not recording.',
  recording_stopped_save_the_lecture: 'Recording stopped. Save the lecture.',
  recording_already_stopped: 'Recording already stopped.',
  recording_worker_failed_restart_to_recover_saved_audio:
    'Recording worker failed. Restart to recover saved audio.',
  no_audio_device_found_connect_it_and_check:
    'No audio device found. Connect it and check Windows audio permissions.',
  audio_device_unavailable_connect_it_and_refresh_devices:
    'Audio device unavailable. Connect it and refresh devices.',
  selected_audio_device: 'Selected audio device',
  this_audio_sample_format_is_unsupported_choose_another:
    'This audio sample format is unsupported. Choose another device.',
  recording_startup_cancelled: 'Recording startup cancelled.',
  audio_device_disconnected_or_unavailable_earlier_audio_is:
    'Audio device disconnected or unavailable. Earlier audio is preserved.',
  no_sound_detected_check_the_audio_source_and:
    'No sound detected. Check the audio source and volume.',
  recording_could_not_finish_normally_saved_audio_will:
    'Recording could not finish normally. Saved audio will be recovered on restart.',
  wait_for_live_caption_processing_to_finish:
    'Wait for live caption processing to finish.',
  stop_recording_this_course_first: 'Stop recording this course first.',
  atask_is_running_for_this_course_cancel:
    'A task is running for this course. Cancel it or wait for completion.',
  choose_avalid_audio_source_and_device:
    'Choose a valid audio source and device.',
  an_audio_test_is_already_running_it_finishes:
    'An audio test is already running. It finishes after five seconds.',
  download_the_local_speech_model_in_settings_ai:
    'Download the local speech model in Settings → AI & models → Local models before class.',
  add_your_speech_provider_key_in_settings_before:
    'Add your speech provider key in Settings before class.',
  another_lecture_is_recording_open_that_lecture_to:
    'Another lecture is recording. Open that lecture to stop it.',
  this_recording_is_not_active_restart_to_recover:
    'This recording is not active. Restart to recover its saved audio.',
  stop_and_save_the_lecture_first: 'Stop and save the lecture first.',
  stop_and_save_the_recording_first: 'Stop and save the recording first.',
  describe_what_you_want_to_review: 'Describe what you want to review.',
  this_lecture_has_no_notes_yet: 'This lecture has no notes yet.',
  storage_usage_is_unavailable: 'Storage usage is unavailable.',
  lecture_deletion_was_interrupted_restart_to_recover_cleanup:
    'Lecture deletion was interrupted. Restart to recover cleanup.',
  permanent_deletion_was_interrupted_restart_to_recover_cleanup:
    'Permanent deletion was interrupted. Restart to recover cleanup.',
  storage_cleanup_was_interrupted_restart_to_recover_cleanup:
    'Storage cleanup was interrupted. Restart to recover cleanup.',
  media_import_could_not_finish: 'Media import could not finish.',
  course_document_not_found: 'Course document not found.',
  stop_and_save_recording_before_cancelling_final_processing:
    'Stop and save recording before cancelling final processing.',
  too_many_draft_identifiers: 'Too many draft identifiers.',
  lecture_not_found_files_will_be_restored:
    'Lecture not found. Files will be restored.',
  content_deleted_but_database_compaction_failed_restart_the:
    'Content deleted, but database compaction failed. Restart the app and try freeing storage again.',
  the_course_does_not_exist: 'The course does not exist.',
  enter_avalid_course_name_subject_and_assistance:
    'Enter a valid course name, subject and assistance language.',
  the_glossary_term_is_empty_or_too_long:
    'The glossary term is empty or too long.',
  the_glossary_does_not_exist: 'The glossary does not exist.',
  cannot_save_this_english_term_may_already_exist:
    'Cannot save: this English term may already exist.',
  transcript_data_is_damaged: 'Transcript data is damaged.',
  check_transcript_content_and_timestamps:
    'Check transcript content and timestamps.',
  transcript_segment_does_not_exist: 'Transcript segment does not exist.',
  the_recovery_record_is_damaged: 'The recovery record is damaged.',
  enter_avalid_lecture_title: 'Enter a valid lecture title.',
  the_lecture_does_not_exist: 'The lecture does not exist.',
  this_database_requires_anewer_lecturerelay_version_upgrade:
    'This database requires a newer LectureRelay version. Upgrade the app.',
  database_migration_failed: 'Database migration failed.',
  classroom_migration_failed: 'Classroom migration failed.',
  study_workspace_migration_failed: 'Study workspace migration failed.',
  reliability_migration_failed: 'Reliability migration failed.',
  reliability_migration_failed_its_integrity_check_existing_database:
    'Reliability migration failed its integrity check. Existing database was preserved.',
  database_unavailable_restart_the_app:
    'Database unavailable. Restart the app.',
  choose_asupported_local_translation_model:
    'Choose a supported local translation model.',
  check_your_language_provider_and_caption_preferences_keep:
    'Check your language, provider and caption preferences. Keep at least one caption language visible.',
  saved_settings_could_not_be_read: 'Saved settings could not be read.',
  saved_review_progress_is_invalid: 'Saved review progress is invalid.',
  saved_review_not_found: 'Saved review not found.',
  review_exceeds_the_supported_size_saved_sections_remain:
    'Review exceeds the supported size. Saved sections remain available.',
  all_source_sections_covered_saved_as_anew:
    'All source sections covered. Saved as a new note version.',
  processing_failed_saved_audio_and_completed_results_are:
    'Processing failed. Saved audio and completed results are preserved.',
  cancelled_saved_results_are_preserved:
    'Cancelled. Saved results are preserved.',
  processing_was_interrupted_resume_from_saved_results:
    'Processing was interrupted. Resume from saved results.',
  notes_exceed_the_supported_size: 'Notes exceed the supported size.',
  draft_exceeds_the_supported_size: 'Draft exceeds the supported size.',
  draft_could_not_be_saved_keep_this_window:
    'Draft could not be saved. Keep this window open.',
  choose_avalid_timestamp_and_ashort_label:
    'Choose a valid timestamp and a short label.',
  unknown_local_model: 'Unknown local model.',
  model_download_interrupted_try_again:
    'Model download interrupted. Try again.',
  model_exceeds_the_expected_size: 'Model exceeds the expected size.',
  model_download_cancelled: 'Model download cancelled.',
  model_integrity_check_failed_download_again:
    'Model integrity check failed. Download again.',
  model_download_inside_another_app:
    'LectureRelay was started from another app, which would store this download separately. Open LectureRelay from the Start menu to download models.',
  authorization_rejected_check_your_api_key_and_account:
    'Authorization rejected. Check your API key and account permissions.',
  model_or_endpoint_unavailable_check_the_model_name:
    'Model or endpoint unavailable. Check the model name.',
  audio_chunk_exceeds_the_provider_limit:
    'Audio chunk exceeds the provider limit.',
  provider_quota_or_rate_limit_reached_try_again:
    'Provider quota or rate limit reached. Try again later.',
  provider_unavailable_try_again_later:
    'Provider unavailable. Try again later.',
  the_provider_could_not_process_this_request_check:
    'The provider could not process this request. Check the model, account and input.',
  provider_response_interrupted_try_again:
    'Provider response interrupted. Try again.',
  provider_response_exceeds_the_size_limit:
    'Provider response exceeds the size limit.',
  provider_response_could_not_be_parsed:
    'Provider response could not be parsed.',
  this_text_exceeds_the_local_model_context_shorten:
    'This text exceeds the local model context. Shorten the requested focus or course background.',
  this_ai_feature_is_off_choose_amodel:
    'This AI feature is off. Choose a model in Settings → AI & models.',
  local_translation_cancelled_recording_is_preserved:
    'Local translation cancelled. Recording is preserved.',
  live_translation_paused_english_and_audio_are_saved:
    'Live translation paused. English and audio are saved; translate missing sentences after class.',
  translation_deferred_while_english_captions_catch_up_saved:
    'Translation deferred while English captions catch up. Saved text can be translated after class.',
  checking_and_loading_local_model: 'Checking and loading local model…',
  local_ai_could_not_load_the_model_check:
    'Local AI could not load the model. Check available memory or reinstall the model. Recording is preserved.',
  local_model_loading_timed_out_recording_is_preserved:
    'Local model loading timed out. Recording is preserved.',
  generating_on_this_computer: 'Generating on this computer…',
  local_ai_request_failed_saved_audio_and_text:
    'Local AI request failed. Saved audio and text are preserved; retry or choose a smaller task.',
  local_ai_response_exceeds_the_limit: 'Local AI response exceeds the limit.',
  local_ai_returned_invalid_data: 'Local AI returned invalid data.',
  local_ai_did_not_complete_its_response_saved:
    'Local AI did not complete its response. Saved results are preserved.',
  local_ai_returned_no_text_try_again: 'Local AI returned no text. Try again.',
  local_ai_connection_stopped_or_timed_out_recording:
    'Local AI connection stopped or timed out. Recording and saved results are preserved.',
  local_model_or_runtime_is_missing_download_again:
    'Local model or runtime is missing. Download again or reinstall the app.',
  local_model_integrity_check_failed_remove_it_and:
    'Local model integrity check failed. Remove it and download again.',
  local_ai_runtime_missing_reinstall_lecturerelay:
    'Local AI runtime missing. Reinstall LectureRelay.',
  use_local_english_for_transcription: 'Use Local English for transcription.',
  cloud_ai_reached_its_output_limit_completed_review:
    'Cloud AI reached its output limit. Completed review sections are saved; retry the remaining work.',
  the_provider_did_not_complete_its_response_saved:
    'The provider did not complete its response. Saved results are preserved.',
  the_provider_returned_no_valid_text_check_the:
    'The provider returned no valid text. Check the model configuration.',
  provider_text_exceeds_the_size_limit: 'Provider text exceeds the size limit.',
  add_akey_for_this_provider_in_settings:
    'Add a key for this provider in Settings.',
  invalid_api_key_format_add_the_key_again:
    'Invalid API key format. Add the key again.',
  connected_but_this_text_model_is_unavailable_check:
    'Connected, but this text model is unavailable. Check the model and account permissions.',
  ai_request_failed_or_timed_out_check_your:
    'AI request failed or timed out. Check your network and try again.',
  transcription_failed_or_timed_out_saved_audio_is:
    'Transcription failed or timed out. Saved audio is preserved.',
  invalid_timestamps_in_the_provider_response:
    'Invalid timestamps in the provider response.',
  the_provider_returned_no_transcript: 'The provider returned no transcript.',
  invalid_translation_response_english_is_preserved_try_translation:
    'Invalid translation response. English is preserved; try translation again.',
  paste_avalid_api_key_without_spaces_or:
    'Paste a valid API key without spaces or newlines.',
  windows_credential_manager_could_not_save_the_key:
    'Windows Credential Manager could not save the key.',
  the_saved_key_is_empty_add_it_again: 'The saved key is empty. Add it again.',
  the_saved_key_cannot_be_read_add_it:
    'The saved key cannot be read. Add it again.',
  windows_credential_manager_could_not_read_the_key:
    'Windows Credential Manager could not read the key.',
  windows_credential_manager_could_not_remove_the_key:
    'Windows Credential Manager could not remove the key.',
  choose_an_ai_provider_and_add_akey:
    'Choose an AI provider and add a key in Settings.',
  download_the_local_speech_model_in_settings_first:
    'Download the local speech model in Settings first.',
  live_translation_timed_out_english_is_preserved:
    'Live translation timed out. English is preserved.',
  english_captions_are_behind_audio_is_still_being:
    'English captions are behind. Audio is still being saved. Try Full performance; remaining text can be transcribed after class.',
  live_transcription_timed_out_recording_continues:
    'Live transcription timed out. Recording continues.',
  invalid_live_speech_response_audio_is_preserved:
    'Invalid live speech response. Audio is preserved.',
  some_translations_need_another_try_your_english_and:
    'Some translations need another try. Your English and audio are saved; retry from lecture replay.',
  invalid_cleanup_path_nothing_was_deleted:
    'Invalid cleanup path. Nothing was deleted.',
  storage_contains_alink_or_junction_cleanup_was:
    'Storage contains a link or junction. Cleanup was stopped to protect files outside LectureRelay.',
  invalid_cleanup_scope_files_were_preserved:
    'Invalid cleanup scope. Files were preserved.',
  content_was_deleted_but_some_files_could_not:
    'Content was deleted, but some files could not be freed. Restart LectureRelay to retry cleanup.',
  cleanup_recovery_found_conflicting_files_keep_both_folders:
    'Cleanup recovery found conflicting files. Keep both folders and restart after resolving the conflict.',
  move_this_course_to_trash_before_deleting_it:
    'Move this course to Trash before deleting it permanently.',
  stop_and_save_this_lecture_before_deleting_it:
    'Stop and save this lecture before deleting it.',
  cleanup_destination_already_exists: 'Cleanup destination already exists.',
  cannot_free_storage_while_files_are_in_use:
    'Cannot free storage while files are in use. Close external players and try again.',
  the_test_data_folder_must_be_an_absolute:
    'The test data folder must be an absolute path.',
  lecturerelay_is_already_running_or_the_app_data:
    'LectureRelay is already running, or the app data folder is not writable.',
  speech_preferences_are_busy: 'Speech preferences are busy.',
  local_recognition_stopped_recording_is_preserved:
    'Local recognition stopped. Recording is preserved.',
  local_speech_response_exceeds_the_limit:
    'Local speech response exceeds the limit.',
  local_speech_response_interrupted: 'Local speech response interrupted.',
  local_recognition_failed_recording_is_preserved_transcribe_after:
    'Local recognition failed. Recording is preserved; transcribe after class.',
  local_speech_returned_invalid_text: 'Local speech returned invalid text.',
  local_recognition_timed_out_recording_continues_transcribe_after:
    'Local recognition timed out. Recording continues; transcribe after class.',
  local_speech_stopped: 'Local speech stopped.',
  cannot_resume_transcription: 'Cannot resume transcription.',
  cannot_read_recording: 'Cannot read recording.',
  task_status_unavailable: 'Task status unavailable.',
  cannot_inspect_pdf: 'Cannot inspect PDF.',
  cannot_read_pdf: 'Cannot read PDF.',
  cannot_read_the_selected_media_file: 'Cannot read the selected media file.',
  cannot_inspect_media: 'Cannot inspect media.',
  unsupported_audio_sample_rate: 'Unsupported audio sample rate.',
  cannot_create_imported_audio_check_disk_space:
    'Cannot create imported audio. Check disk space.',
  cannot_write_imported_audio_check_disk_space:
    'Cannot write imported audio. Check disk space.',
  cannot_save_imported_audio: 'Cannot save imported audio.',
  cannot_finalize_imported_audio: 'Cannot finalize imported audio.',
  cannot_identify_review_source: 'Cannot identify review source.',
  cannot_list_audio_devices_check_windows_permissions:
    'Cannot list audio devices. Check Windows permissions.',
  cannot_start_audio_capture_check_windows_audio_permissions:
    'Cannot start audio capture. Check Windows audio permissions or choose another device.',
  cannot_open_this_audio_input_check_windows_audio:
    'Cannot open this audio input. Check Windows audio permissions.',
  cannot_start_the_audio_test_close_apps_holding:
    'Cannot start the audio test. Close apps holding the device.',
  recording_status_unavailable: 'Recording status unavailable.',
  cannot_start_the_recording_worker: 'Cannot start the recording worker.',
  cannot_open_the_audio_device_check_the_device:
    'Cannot open the audio device. Check the device and Windows permissions.',
  cannot_create_the_recording_file_check_disk_space:
    'Cannot create the recording file. Check disk space and permissions.',
  cannot_initialize_the_recording_file: 'Cannot initialize the recording file.',
  cannot_initialize_wav_recording: 'Cannot initialize WAV recording.',
  cannot_save_the_wav_header: 'Cannot save the WAV header.',
  cannot_start_audio_capture_close_apps_holding_the:
    'Cannot start audio capture. Close apps holding the device.',
  cannot_resume_the_audio_device_earlier_audio_is:
    'Cannot resume the audio device. Earlier audio is preserved.',
  cannot_write_audio_check_available_disk_space:
    'Cannot write audio. Check available disk space.',
  cannot_save_audio_check_available_disk_space:
    'Cannot save audio. Check available disk space.',
  cannot_save_the_recovery_checkpoint_check_available_disk:
    'Cannot save the recovery checkpoint. Check available disk space.',
  cannot_save_the_end_of_the_recording: 'Cannot save the end of the recording.',
  cannot_encode_audio_chunk: 'Cannot encode audio chunk.',
  cannot_check_audio_devices: 'Cannot check audio devices.',
  cannot_test_the_audio_input: 'Cannot test the audio input.',
  cannot_start_lecture_recording: 'Cannot start lecture recording.',
  cannot_save_the_lecture_written_audio_is_preserved:
    'Cannot save the lecture. Written audio is preserved.',
  invalid_subtitle_format: 'Invalid subtitle format.',
  cannot_encode_transcript_export: 'Cannot encode transcript export.',
  unsupported_export_format: 'Unsupported export format.',
  invalid_storage_folder: 'Invalid storage folder.',
  cannot_open_file_explorer: 'Cannot open File Explorer.',
  cannot_list_audio_devices: 'Cannot list audio devices.',
  model_status_unavailable: 'Model status unavailable.',
  cannot_create_course_documents_folder:
    'Cannot create course documents folder.',
  cannot_attach_course_pdf: 'Cannot attach course PDF.',
  cannot_read_course_pdf: 'Cannot read course PDF.',
  cannot_open_the_print_dialog: 'Cannot open the print dialog.',
  cannot_show_captions: 'Cannot show captions.',
  cannot_open_caption_window: 'Cannot open caption window.',
  cannot_close_captions: 'Cannot close captions.',
  cannot_check_local_drafts: 'Cannot check local drafts.',
  invalid_draft_identifier: 'Invalid draft identifier.',
  cannot_check_storage_cleanup: 'Cannot check storage cleanup.',
  cannot_finish_storage_cleanup: 'Cannot finish storage cleanup.',
  cannot_begin_deletion: 'Cannot begin deletion.',
  cannot_delete_course_data_files_will_be_restored:
    'Cannot delete course data. Files will be restored.',
  cannot_delete_course_documents: 'Cannot delete course documents.',
  cannot_delete_courses: 'Cannot delete courses.',
  cannot_clear_model_records: 'Cannot clear model records.',
  cannot_commit_deletion: 'Cannot commit deletion.',
  cannot_commit_deletion_files_will_be_restored:
    'Cannot commit deletion. Files will be restored.',
  cannot_begin_lecture_deletion: 'Cannot begin lecture deletion.',
  cannot_delete_lecture_data_files_will_be_restored:
    'Cannot delete lecture data. Files will be restored.',
  cannot_delete_lecture: 'Cannot delete lecture.',
  cannot_commit_lecture_deletion: 'Cannot commit lecture deletion.',
  cannot_commit_lecture_deletion_files_will_be_restored:
    'Cannot commit lecture deletion. Files will be restored.',
  cannot_read_course: 'Cannot read course.',
  cannot_read_course_data: 'Cannot read course data.',
  cannot_save_course: 'Cannot save course.',
  cannot_delete_course: 'Cannot delete course.',
  cannot_read_trash: 'Cannot read Trash.',
  cannot_restore_course: 'Cannot restore course.',
  cannot_read_glossary: 'Cannot read glossary.',
  cannot_delete_glossary: 'Cannot delete glossary.',
  cannot_read_live_captions: 'Cannot read live captions.',
  cannot_read_transcript: 'Cannot read transcript.',
  cannot_save_transcript: 'Cannot save transcript.',
  cannot_save_transcript_segments: 'Cannot save transcript segments.',
  cannot_save_transcription_progress: 'Cannot save transcription progress.',
  cannot_commit_transcript_segments: 'Cannot commit transcript segments.',
  cannot_save_translation: 'Cannot save translation.',
  cannot_read_recovery_record: 'Cannot read recovery record.',
  cannot_save_audio_source: 'Cannot save audio source.',
  cannot_create_the_recording_folder_check_permissions:
    'Cannot create the recording folder. Check permissions.',
  cannot_save_lecture: 'Cannot save lecture.',
  cannot_read_lecture: 'Cannot read lecture.',
  cannot_read_lecture_data: 'Cannot read lecture data.',
  cannot_save_lecture_status: 'Cannot save lecture status.',
  cannot_open_the_local_database: 'Cannot open the local database.',
  cannot_initialize_the_database: 'Cannot initialize the database.',
  cannot_read_database_version: 'Cannot read database version.',
  cannot_start_database_migration: 'Cannot start database migration.',
  cannot_save_database_version: 'Cannot save database version.',
  cannot_commit_database_migration: 'Cannot commit database migration.',
  cannot_start_classroom_migration: 'Cannot start classroom migration.',
  cannot_commit_classroom_migration: 'Cannot commit classroom migration.',
  cannot_start_study_workspace_migration:
    'Cannot start study workspace migration.',
  cannot_commit_study_workspace_migration:
    'Cannot commit study workspace migration.',
  cannot_prepare_reliability_migration: 'Cannot prepare reliability migration.',
  cannot_start_reliability_migration: 'Cannot start reliability migration.',
  cannot_verify_migration: 'Cannot verify migration.',
  cannot_commit_reliability_migration: 'Cannot commit reliability migration.',
  cannot_enable_database_integrity_checks:
    'Cannot enable database integrity checks.',
  cannot_repair_import_metadata: 'Cannot repair import metadata.',
  cannot_recover_processing_tasks: 'Cannot recover processing tasks.',
  cannot_save_model_metadata: 'Cannot save model metadata.',
  cannot_remove_model_metadata: 'Cannot remove model metadata.',
  cannot_read_settings: 'Cannot read settings.',
  cannot_encode_settings: 'Cannot encode settings.',
  cannot_save_settings: 'Cannot save settings.',
  cannot_read_saved_reviews: 'Cannot read saved reviews.',
  cannot_read_review_progress: 'Cannot read review progress.',
  cannot_read_saved_review: 'Cannot read saved review.',
  cannot_encode_review_progress: 'Cannot encode review progress.',
  cannot_save_review_progress_previously_saved_sections_are:
    'Cannot save review progress. Previously saved sections are preserved.',
  cannot_publish_review: 'Cannot publish review.',
  invalid_review_progress: 'Invalid review progress.',
  cannot_publish_review_version: 'Cannot publish review version.',
  cannot_encode_published_review: 'Cannot encode published review.',
  cannot_save_published_review: 'Cannot save published review.',
  cannot_commit_published_review: 'Cannot commit published review.',
  cannot_save_processing_task_no_request_was_sent:
    'Cannot save processing task. No request was sent.',
  cannot_save_task_progress: 'Cannot save task progress.',
  cannot_save_task_outcome: 'Cannot save task outcome.',
  cannot_read_processing_history: 'Cannot read processing history.',
  cannot_read_tasks: 'Cannot read tasks.',
  invalid_translation_result: 'Invalid translation result.',
  cannot_save_note_version: 'Cannot save note version.',
  cannot_clear_draft: 'Cannot clear draft.',
  cannot_save_bookmark: 'Cannot save bookmark.',
  cannot_remove_bookmark: 'Cannot remove bookmark.',
  cannot_read_course_documents: 'Cannot read course documents.',
  cannot_read_documents: 'Cannot read documents.',
  cannot_save_course_document: 'Cannot save course document.',
  cannot_read_bookmarks: 'Cannot read bookmarks.',
  cannot_read_note_history: 'Cannot read note history.',
  cannot_read_draft: 'Cannot read draft.',
  cannot_save_pin: 'Cannot save pin.',
  cannot_search_library: 'Cannot search library.',
  model_manager_unavailable: 'Model manager unavailable.',
  cannot_initialize_model_download: 'Cannot initialize model download.',
  cannot_create_model_folder: 'Cannot create model folder.',
  cannot_download_model_check_your_connection:
    'Cannot download model. Check your connection.',
  model_download_unavailable: 'Model download unavailable.',
  cannot_create_model_file_check_disk_space:
    'Cannot create model file. Check disk space.',
  cannot_write_model_check_disk_space: 'Cannot write model. Check disk space.',
  cannot_save_model: 'Cannot save model.',
  cannot_install_model: 'Cannot install model.',
  cannot_save_model_license_reinstall_lecturerelay:
    'Cannot save model license. Reinstall LectureRelay.',
  cannot_remove_model: 'Cannot remove model.',
  cannot_check_local_model_process: 'Cannot check local model process.',
  local_tokenizer_unavailable: 'Local tokenizer unavailable.',
  invalid_local_token_count: 'Invalid local token count.',
  cannot_read_local_model_check_disk_space_and:
    'Cannot read local model. Check disk space and permissions.',
  invalid_local_ai_runtime_manifest: 'Invalid local AI runtime manifest.',
  invalid_runtime_manifest: 'Invalid runtime manifest.',
  invalid_runtime_file_name: 'Invalid runtime file name.',
  invalid_runtime_checksum: 'Invalid runtime checksum.',
  cannot_allocate_alocal_ai_connection:
    'Cannot allocate a local AI connection.',
  cannot_read_local_ai_connection: 'Cannot read local AI connection.',
  cannot_initialize_local_ai: 'Cannot initialize local AI.',
  cannot_initialize_local_ai_client: 'Cannot initialize local AI client.',
  cannot_start_local_ai_reinstall_lecturerelay:
    'Cannot start local AI. Reinstall LectureRelay.',
  unsupported_translation_language: 'Unsupported translation language.',
  cannot_initialize_asecure_connection:
    'Cannot initialize a secure connection.',
  cannot_reach_the_provider_check_your_network_connection:
    'Cannot reach the provider. Check your network connection.',
  cannot_encode_audio_upload: 'Cannot encode audio upload.',
  cannot_encode_translation_input: 'Cannot encode translation input.',
  live_caption_status_unavailable: 'Live caption status unavailable.',
  diagnostics_unavailable: 'Diagnostics unavailable.',
  live_status_unavailable: 'Live status unavailable.',
  unsupported_live_audio_format: 'Unsupported live audio format.',
  cannot_read_live_audio_checkpoint: 'Cannot read live audio checkpoint.',
  cannot_read_live_audio_recording_continues:
    'Cannot read live audio. Recording continues.',
  speech_provider_unavailable: 'Speech provider unavailable.',
  cannot_encode_diagnostics: 'Cannot encode diagnostics.',
  cannot_inspect_storage_for_cleanup_check_permissions:
    'Cannot inspect storage for cleanup. Check permissions.',
  cannot_inspect_storage: 'Cannot inspect storage.',
  cannot_inspect_cleanup_recovery: 'Cannot inspect cleanup recovery.',
  cannot_restore_interrupted_cleanup: 'Cannot restore interrupted cleanup.',
  cannot_restore_files_after_interrupted_cleanup:
    'Cannot restore files after interrupted cleanup.',
  cannot_finish_cleanup_recovery: 'Cannot finish cleanup recovery.',
  cannot_read_cleanup_journal: 'Cannot read cleanup journal.',
  invalid_cleanup_journal: 'Invalid cleanup journal.',
  invalid_cleanup_journal_name: 'Invalid cleanup journal name.',
  invalid_cleanup_destination: 'Invalid cleanup destination.',
  invalid_course: 'Invalid course.',
  invalid_lecture: 'Invalid lecture.',
  cannot_inspect_course_files: 'Cannot inspect course files.',
  cannot_prepare_cleanup_journal: 'Cannot prepare cleanup journal.',
  cannot_locate_the_windows_app_data_folder:
    'Cannot locate the Windows app data folder.',
  cannot_locate_the_windows_documents_folder:
    'Cannot locate the Windows Documents folder.',
  cannot_create_the_app_data_folder_check_permissions:
    'Cannot create the app data folder. Check permissions.',
  cannot_create_the_library_folder_check_documents_permissions:
    'Cannot create the library folder. Check Documents permissions.',
  invalid_course_or_lecture_identifier: 'Invalid course or lecture identifier.',
  cannot_create_the_lecture_folder: 'Cannot create the lecture folder.',
  cannot_encode_lecture_metadata: 'Cannot encode lecture metadata.',
  cannot_encode_transcript: 'Cannot encode transcript.',
  invalid_local_file_path: 'Invalid local file path.',
  cannot_write_alocal_file_check_disk_space:
    'Cannot write a local file. Check disk space.',
  cannot_write_the_file_check_available_disk_space:
    'Cannot write the file. Check available disk space.',
  cannot_save_file: 'Cannot save file.',
  cannot_update_the_file_check_whether_another_app:
    'Cannot update the file. Check whether another app is using it.',
  cannot_save_lecture_snapshot: 'Cannot save lecture snapshot.',
  storage_usage_is_unavailable_check_folder_permissions:
    'Storage usage is unavailable. Check folder permissions.',
  cannot_read_available_cpu_resources: 'Cannot read available CPU resources.',
  cannot_manage_local_speech_performance:
    'Cannot manage local speech performance.',
  cannot_check_local_speech_worker: 'Cannot check local speech worker.',
  cannot_change_local_speech_performance:
    'Cannot change local speech performance.',
  invalid_local_speech_audio: 'Invalid local speech audio.',
  unsupported_local_speech_audio: 'Unsupported local speech audio.',
  cannot_read_local_speech_audio: 'Cannot read local speech audio.',
  local_recognition_unavailable: 'Local recognition unavailable.',
  local_speech_worker_unavailable: 'Local speech worker unavailable.',
  cannot_start_local_speech_recognition_reinstall_lecturerelay:
    'Cannot start local speech recognition. Reinstall LectureRelay.',
  local_speech_input_unavailable: 'Local speech input unavailable.',
  local_speech_output_unavailable: 'Local speech output unavailable.',
  cannot_set_speech_glossary: 'Cannot set speech glossary.',
  invalid_local_streaming_response: 'Invalid local streaming response.',
  invalid_local_speech_chunk: 'Invalid local speech chunk.',
  cannot_contain_local_speech_worker: 'Cannot contain local speech worker.',
  alive_summary_is_being_processed_wait_for:
    'A live summary is being processed. Wait for it to finish or turn summaries off.',
  wait_for_the_model_download_to_finish:
    'Wait for the model download to finish.',
  wait_for_the_five_second_audio_test_to:
    'Wait for the five-second audio test to finish.',
  choose_avalid_summary_service_model_and_an:
    'Choose a valid summary service, model and an interval of 2, 4 or 5 minutes.',
  before_enabling_cloud_summaries_allow_the_selected_provider:
    'Before enabling cloud summaries, allow the selected provider to receive the matching English transcript and course background.',
  cannot_read_live_summary_settings: 'Cannot read live summary settings.',
  cannot_save_live_summary_settings: 'Cannot save live summary settings.',
  cannot_turn_off_the_old_local_live_summary:
    'Cannot turn off the old local live summary setting.',
  summary_processing_was_interrupted_the_source_text_is:
    'Summary processing was interrupted. The source text is saved; retry on this card.',
  another_summary_is_being_processed_please_wait:
    'Another summary is being processed. Please wait.',
  cannot_read_the_summary_rate_limit_status:
    'Cannot read the summary rate-limit status.',
  the_summary_service_is_still_rate_limited_recording:
    'The summary service is still rate limited. Recording and captions continue to be saved; try again later.',
  the_summary_format_is_incomplete_try_again_incomplete:
    'The summary format is incomplete. Try again; incomplete results are not shown as key points.',
  the_summary_length_or_citations_are_invalid_try:
    'The summary length or citations are invalid. Try again.',
  the_summary_cites_source_text_that_does_not:
    'The summary cites source text that does not exist. The source is preserved; try again.',
  set_up_and_enable_live_summaries_first:
    'Set up and enable live summaries first.',
  save_and_test_an_api_key_in_live:
    'Save and test an API key in live summary settings first. Recording and captions are not affected.',
  asummary_is_still_unfinished_retry_it_on:
    'A summary is still unfinished. Retry it on its card; new source text continues to be saved.',
  there_is_no_newly_finalized_english_yet_try:
    'There is no newly finalized English yet. Try again later.',
  the_summary_was_cancelled_or_its_settings_changed:
    'The summary was cancelled or its settings changed. The unfinished section is kept; you can retry later.',
  the_summary_timed_out_the_source_text_is:
    'The summary timed out. The source text is saved; you can retry later.',
  summary_card_not_found: 'Summary card not found.',
  the_source_text_was_not_found: 'The source text was not found.',
  the_recording_cannot_be_read_right_now_try:
    'The recording cannot be read right now. Try again later.',
  this_recording_format_does_not_support_section_playback:
    'This recording format does not support section playback.',
  this_part_of_the_recording_is_not_finished:
    'This part of the recording is not finished yet. Play it again later.',
  cannot_locate_the_recording_section: 'Cannot locate the recording section.',
  reading_the_recording_section_failed_try_again_later:
    'Reading the recording section failed. Try again later.',
  cannot_read_the_recording_section: 'Cannot read the recording section.',
  save_the_api_key_then_select_test_summary:
    'Save the API key, then select Test summary connection; summaries can be enabled after it succeeds.',
  the_summary_connection_test_timed_out_check_your:
    'The summary connection test timed out. Check your network and try again.',
  the_key_or_summary_settings_changed_during_the:
    'The key or summary settings changed during the test. Test again.',
  cannot_open_this_service_page: 'Cannot open this service page.',
  cannot_open_the_system_browser_check_your_default:
    'Cannot open the system browser. Check your default browser setting.',
  the_source_text_or_assistance_language_changed_summarize:
    'The source text or assistance language changed. Summarize again and review it.',
  there_is_no_newly_finalized_english_yet:
    'There is no newly finalized English yet.',
  the_summary_sources_are_duplicated_select_them_again:
    'The summary sources are duplicated. Select them again.',
  the_source_text_changed_try_again: 'The source text changed. Try again.',
  this_source_text_already_has_asummary_check:
    'This source text already has a summary. Check the existing card or retry.',
  this_summary_card_was_not_found: 'This summary card was not found.',
  this_section_is_being_summarized_please_wait:
    'This section is being summarized. Please wait.',
  the_source_text_was_deleted_so_this_summary:
    'The source text was deleted, so this summary cannot be retried.',
  the_source_text_changed_so_the_old_result:
    'The source text changed, so the old result was not used as the latest summary. Try again.',
  the_api_key_is_invalid_or_revoked_replace:
    'The API key is invalid or revoked. Replace it and test again.',
  account_balance_or_api_billing_is_not_ready:
    'Account balance or API billing is not ready. Check the provider account; recording continues to be saved.',
  the_account_lacks_access_check_the_service_region:
    'The account lacks access. Check the service region, model permissions and account status.',
  the_selected_model_is_unavailable_choose_another_model:
    'The selected model is unavailable. Choose another model in advanced settings and test again.',
  the_free_allowance_is_used_up_or_requests:
    'The free allowance is used up or requests are limited. Check the account quota and try again later; recording continues to be saved.',
  the_model_does_not_support_these_summary_parameters:
    'The model does not support these summary parameters. Use the recommended model or check the advanced model settings.',
  the_provider_is_temporarily_unavailable_the_source_text:
    'The provider is temporarily unavailable. The source text is saved; try again later.',
  the_summary_request_did_not_complete_check_the:
    'The summary request did not complete. Check the account and model settings. The source text is saved.',
  cannot_reach_the_summary_service_or_the_request:
    'Cannot reach the summary service or the request timed out. Check your network and try again; recording continues to be saved.',
  the_summary_did_not_finish_before_the_app:
    'The summary did not finish before the app closed. The source text is saved; you can retry it.',
  atranscript_is_needed_to_answer_from_lecture:
    'A transcript is needed to answer from lecture evidence.',
  cannot_read_summary_language: 'Cannot read summary language.',
  cannot_check_summary_references: 'Cannot check summary references.',
  cannot_read_live_summaries: 'Cannot read live summaries.',
  cannot_read_saved_summary_cards: 'Cannot read saved summary cards.',
  cannot_mark_an_outdated_summary: 'Cannot mark an outdated summary.',
  cannot_reserve_asummary: 'Cannot reserve a summary.',
  cannot_check_summary_coverage: 'Cannot check summary coverage.',
  cannot_check_saved_summary_sources: 'Cannot check saved summary sources.',
  cannot_encode_summary_sources: 'Cannot encode summary sources.',
  cannot_save_summary_input_no_request_was_sent:
    'Cannot save summary input. No request was sent.',
  cannot_save_summary_input: 'Cannot save summary input.',
  cannot_retry_summary: 'Cannot retry summary.',
  cannot_save_live_summary: 'Cannot save live summary.',
  cannot_encode_summary: 'Cannot encode summary.',
  cannot_save_summary_outcome: 'Cannot save summary outcome.',
  cannot_save_connection_test: 'Cannot save connection test.',
  cannot_clear_connection_test: 'Cannot clear connection test.',
  cannot_read_connection_test: 'Cannot read connection test.',
  app_closed_before_processing_finished_saved_results_are:
    'App closed before processing finished. Saved results are preserved.',
  cannot_start_live_summary_migration: 'Cannot start live summary migration.',
  live_summary_migration_failed: 'Live summary migration failed.',
  cannot_commit_live_summary_migration: 'Cannot commit live summary migration.',
  cannot_recover_live_summaries: 'Cannot recover live summaries.',
  cannot_prepare_language_migration:
    'Cannot prepare translation language migration.',
  cannot_start_language_migration:
    'Cannot start translation language migration.',
  language_migration_failed: 'Translation language migration failed.',
  language_migration_failed_its_integrity_check:
    'Translation language migration failed its integrity check. Existing database was preserved.',
  cannot_commit_language_migration:
    'Cannot commit translation language migration.',
  cannot_start_speaker_migration: 'Cannot start speaker label migration.',
  speaker_migration_failed: 'Speaker label migration failed.',
  cannot_commit_speaker_migration: 'Cannot commit speaker label migration.',
  speaker_name_is_empty_or_too_long:
    'Enter a speaker name of up to 40 characters.',
  cannot_save_speaker: 'Cannot save the speaker.',
  cannot_read_speakers: 'Cannot read speakers.',
  download_the_speaker_model_first:
    'Download the speaker model in Settings → AI & models → Local models first.',
  transcribe_before_detecting_speakers:
    'Transcribe the lecture before detecting speakers.',
  speaker_detection_failed_transcript_is_unchanged:
    'Speaker detection failed. The transcript is unchanged.',
  enter_an_https_link_to_an_audio_or_video_file:
    'Enter an https link to an audio or video file.',
  cannot_download_that_link_check_it_and_your_connection:
    'Cannot download that link. Check the link and your connection.',
  that_link_opens_web_page_not_media_file:
    'That link opens a web page, not an audio or video file. Video sites such as YouTube are not supported.',
  media_download_was_interrupted_try_again:
    'The download was interrupted. Try again.',
  cannot_switch_audio_device_the_current_one_keeps_recording:
    'Cannot switch to that device. Recording continues on the current one.',
};
