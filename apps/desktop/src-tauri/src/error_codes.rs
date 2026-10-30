// Stable IPC identities. Keep an existing variant/wire code when revising its English text.
use serde::Serialize;
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    NotesAreTooLongShortenThemBeforeSaving,
    CannotReadNotes,
    CannotSaveNotes,
    CannotReadAnswers,
    CannotEncodeAnswerSources,
    CannotSaveAnswers,
    TheAnswerSourcesIsDamaged,
    OperationFailed,
    LiveTranslationPreviewSuperseded,
    LiveTranslationQueueUnavailable,
    TypeDeleteToConfirmPermanentDeletion,
    TypeDeleteAllToConfirmFreeingAllClass,
    CannotSafelyStartLocalSpeechWorker,
    StopAndSaveTheRecordingBeforeTranscription,
    AudioCannotBeReadTheRecordingMayNot,
    ThisRecordingFormatIsNotSupportedForTranscription,
    InvalidTranscriptionTimestampsOrTextSavedContentIs,
    NoEnglishSegmentsNeedTranslation,
    SomeTranslationsAreMissingEnglishIsPreservedRun,
    TranscriptOrTargetLanguageChangedOldTranslationsWere,
    EnterAQuestionOfNoMoreThan2,
    SplitLongTranscriptSegmentsIntoShorterSectionsBefore,
    ChooseASubtitleLanguage,
    NoSubtitlesAreAvailableInThisLanguage,
    AnotherAiTaskIsRunningWaitOrCancel,
    TaskCancelledSavedResultsArePreserved,
    TheLocalPdfIsMissingOrUnreadable,
    ChooseAValidPdfSmallerThan50Mib,
    ChooseAMediaFileSmallerThan2Gib,
    ThisMediaFormatIsUnsupportedOrDamaged,
    NoSupportedAudioTrackWasFound,
    UnknownAudioSampleRate,
    ThisAudioCodecIsUnsupported,
    MediaDecodingFailedTheOriginalFileWasNot,
    AudioIsDamagedOrUsesAnUnsupportedCodec,
    ChangingAudioFormatIsUnsupported,
    MediaExceedsTheFiveHourImportLimit,
    TheSelectedFileContainsNoDecodableAudio,
    TheAudioTrackEndedUnexpectedlyOriginalMediaIs,
    TheTranscriptCourseContextLanguageOrModelChanged,
    KeepReviewInstructionsUnder2000Characters,
    AddOrGenerateATranscriptFirst,
    ReviewAssemblyIsIncomplete,
    ASmallReviewSectionStillExceedsTheModel,
    SourceCoverageIsIncomplete,
    LocalAiReachedItsOutputLimitCompletedReview,
    TheAudioDeviceReportedADiscontinuityCheckThe,
    TheAudioDeviceReturnedAnInvalidFormat,
    InvalidAudioDeviceSelectItAgain,
    ThisAudioFormatIsUnsupportedChooseAnotherDevice,
    AudioDeviceDisconnectedDuringTheTest,
    AnotherLectureIsRecordingStopItFirst,
    AudioStartupTimedOutCheckTheDeviceAnd,
    ThisLectureIsNotRecording,
    RecordingStoppedSaveTheLecture,
    RecordingAlreadyStopped,
    RecordingWorkerFailedRestartToRecoverSavedAudio,
    NoAudioDeviceFoundConnectItAndCheck,
    AudioDeviceUnavailableConnectItAndRefreshDevices,
    SelectedAudioDevice,
    ThisAudioSampleFormatIsUnsupportedChooseAnother,
    RecordingStartupCancelled,
    AudioDeviceDisconnectedOrUnavailableEarlierAudioIs,
    NoSoundDetectedCheckTheAudioSourceAnd,
    RecordingCouldNotFinishNormallySavedAudioWill,
    WaitForLiveCaptionProcessingToFinish,
    StopRecordingThisCourseFirst,
    ATaskIsRunningForThisCourseCancel,
    ChooseAValidAudioSourceAndDevice,
    AnAudioTestIsAlreadyRunningItFinishes,
    DownloadTheLocalSpeechModelInSettingsAi,
    AddYourSpeechProviderKeyInSettingsBefore,
    AnotherLectureIsRecordingOpenThatLectureTo,
    ThisRecordingIsNotActiveRestartToRecover,
    StopAndSaveTheLectureFirst,
    StopAndSaveTheRecordingFirst,
    DescribeWhatYouWantToReview,
    ThisLectureHasNoNotesYet,
    StorageUsageIsUnavailable,
    LectureDeletionWasInterruptedRestartToRecoverCleanup,
    PermanentDeletionWasInterruptedRestartToRecoverCleanup,
    StorageCleanupWasInterruptedRestartToRecoverCleanup,
    MediaImportCouldNotFinish,
    CourseDocumentNotFound,
    StopAndSaveRecordingBeforeCancellingFinalProcessing,
    TooManyDraftIdentifiers,
    LectureNotFoundFilesWillBeRestored,
    ContentDeletedButDatabaseCompactionFailedRestartThe,
    TheCourseDoesNotExist,
    EnterAValidCourseNameSubjectAndAssistance,
    TheGlossaryTermIsEmptyOrTooLong,
    TheGlossaryDoesNotExist,
    CannotSaveThisEnglishTermMayAlreadyExist,
    TranscriptDataIsDamaged,
    CheckTranscriptContentAndTimestamps,
    TranscriptSegmentDoesNotExist,
    TheRecoveryRecordIsDamaged,
    EnterAValidLectureTitle,
    TheLectureDoesNotExist,
    ThisDatabaseRequiresANewerLecturerelayVersionUpgrade,
    DatabaseMigrationFailed,
    ClassroomMigrationFailed,
    StudyWorkspaceMigrationFailed,
    ReliabilityMigrationFailed,
    ReliabilityMigrationFailedItsIntegrityCheckExistingDatabase,
    DatabaseUnavailableRestartTheApp,
    ChooseASupportedLocalTranslationModel,
    CheckYourLanguageProviderAndCaptionPreferencesKeep,
    SavedSettingsCouldNotBeRead,
    SavedReviewProgressIsInvalid,
    SavedReviewNotFound,
    ReviewExceedsTheSupportedSizeSavedSectionsRemain,
    AllSourceSectionsCoveredSavedAsANew,
    ProcessingFailedSavedAudioAndCompletedResultsAre,
    CancelledSavedResultsArePreserved,
    ProcessingWasInterruptedResumeFromSavedResults,
    NotesExceedTheSupportedSize,
    DraftExceedsTheSupportedSize,
    DraftCouldNotBeSavedKeepThisWindow,
    ChooseAValidTimestampAndAShortLabel,
    UnknownLocalModel,
    ModelDownloadInterruptedTryAgain,
    ModelExceedsTheExpectedSize,
    ModelDownloadCancelled,
    ModelIntegrityCheckFailedDownloadAgain,
    ModelDownloadInsideAnotherApp,
    AuthorizationRejectedCheckYourApiKeyAndAccount,
    ModelOrEndpointUnavailableCheckTheModelName,
    AudioChunkExceedsTheProviderLimit,
    ProviderQuotaOrRateLimitReachedTryAgain,
    ProviderUnavailableTryAgainLater,
    TheProviderCouldNotProcessThisRequestCheck,
    ProviderResponseInterruptedTryAgain,
    ProviderResponseExceedsTheSizeLimit,
    ProviderResponseCouldNotBeParsed,
    ThisTextExceedsTheLocalModelContextShorten,
    ThisAiFeatureIsOffChooseAModel,
    LocalTranslationCancelledRecordingIsPreserved,
    LiveTranslationPausedEnglishAndAudioAreSaved,
    TranslationDeferredWhileEnglishCaptionsCatchUpSaved,
    CheckingAndLoadingLocalModel,
    LocalAiCouldNotLoadTheModelCheck,
    LocalModelLoadingTimedOutRecordingIsPreserved,
    GeneratingOnThisComputer,
    LocalAiRequestFailedSavedAudioAndText,
    LocalAiResponseExceedsTheLimit,
    LocalAiReturnedInvalidData,
    LocalAiDidNotCompleteItsResponseSaved,
    LocalAiReturnedNoTextTryAgain,
    LocalAiConnectionStoppedOrTimedOutRecording,
    LocalModelOrRuntimeIsMissingDownloadAgain,
    LocalModelIntegrityCheckFailedRemoveItAnd,
    LocalAiRuntimeMissingReinstallLecturerelay,
    UseLocalEnglishForTranscription,
    CloudAiReachedItsOutputLimitCompletedReview,
    TheProviderDidNotCompleteItsResponseSaved,
    TheProviderReturnedNoValidTextCheckThe,
    ProviderTextExceedsTheSizeLimit,
    AddAKeyForThisProviderInSettings,
    InvalidApiKeyFormatAddTheKeyAgain,
    ConnectedButThisTextModelIsUnavailableCheck,
    AiRequestFailedOrTimedOutCheckYour,
    TranscriptionFailedOrTimedOutSavedAudioIs,
    InvalidTimestampsInTheProviderResponse,
    TheProviderReturnedNoTranscript,
    InvalidTranslationResponseEnglishIsPreservedTryTranslation,
    PasteAValidApiKeyWithoutSpacesOr,
    WindowsCredentialManagerCouldNotSaveTheKey,
    TheSavedKeyIsEmptyAddItAgain,
    TheSavedKeyCannotBeReadAddIt,
    WindowsCredentialManagerCouldNotReadTheKey,
    WindowsCredentialManagerCouldNotRemoveTheKey,
    ChooseAnAiProviderAndAddAKey,
    DownloadTheLocalSpeechModelInSettingsFirst,
    LiveTranslationTimedOutEnglishIsPreserved,
    EnglishCaptionsAreBehindAudioIsStillBeing,
    LiveTranscriptionTimedOutRecordingContinues,
    InvalidLiveSpeechResponseAudioIsPreserved,
    SomeTranslationsNeedAnotherTryYourEnglishAnd,
    InvalidCleanupPathNothingWasDeleted,
    StorageContainsALinkOrJunctionCleanupWas,
    InvalidCleanupScopeFilesWerePreserved,
    ContentWasDeletedButSomeFilesCouldNot,
    CleanupRecoveryFoundConflictingFilesKeepBothFolders,
    MoveThisCourseToTrashBeforeDeletingIt,
    StopAndSaveThisLectureBeforeDeletingIt,
    CleanupDestinationAlreadyExists,
    CannotFreeStorageWhileFilesAreInUse,
    TheTestDataFolderMustBeAnAbsolute,
    LecturerelayIsAlreadyRunningOrTheAppData,
    SpeechPreferencesAreBusy,
    LocalRecognitionStoppedRecordingIsPreserved,
    LocalSpeechResponseExceedsTheLimit,
    LocalSpeechResponseInterrupted,
    LocalRecognitionFailedRecordingIsPreservedTranscribeAfter,
    LocalSpeechReturnedInvalidText,
    LocalRecognitionTimedOutRecordingContinuesTranscribeAfter,
    LocalSpeechStopped,
    CannotResumeTranscription,
    CannotReadRecording,
    TaskStatusUnavailable,
    CannotInspectPdf,
    CannotReadPdf,
    CannotReadTheSelectedMediaFile,
    CannotInspectMedia,
    UnsupportedAudioSampleRate,
    CannotCreateImportedAudioCheckDiskSpace,
    CannotWriteImportedAudioCheckDiskSpace,
    CannotSaveImportedAudio,
    CannotFinalizeImportedAudio,
    CannotIdentifyReviewSource,
    CannotListAudioDevicesCheckWindowsPermissions,
    CannotStartAudioCaptureCheckWindowsAudioPermissions,
    CannotOpenThisAudioInputCheckWindowsAudio,
    CannotStartTheAudioTestCloseAppsHolding,
    RecordingStatusUnavailable,
    CannotStartTheRecordingWorker,
    CannotOpenTheAudioDeviceCheckTheDevice,
    CannotCreateTheRecordingFileCheckDiskSpace,
    CannotInitializeTheRecordingFile,
    CannotInitializeWavRecording,
    CannotSaveTheWavHeader,
    CannotStartAudioCaptureCloseAppsHoldingThe,
    CannotResumeTheAudioDeviceEarlierAudioIs,
    CannotWriteAudioCheckAvailableDiskSpace,
    CannotSaveAudioCheckAvailableDiskSpace,
    CannotSaveTheRecoveryCheckpointCheckAvailableDisk,
    CannotSaveTheEndOfTheRecording,
    CannotEncodeAudioChunk,
    CannotCheckAudioDevices,
    CannotTestTheAudioInput,
    CannotStartLectureRecording,
    CannotSaveTheLectureWrittenAudioIsPreserved,
    InvalidSubtitleFormat,
    CannotEncodeTranscriptExport,
    UnsupportedExportFormat,
    InvalidStorageFolder,
    CannotOpenFileExplorer,
    CannotListAudioDevices,
    ModelStatusUnavailable,
    CannotCreateCourseDocumentsFolder,
    CannotAttachCoursePdf,
    CannotReadCoursePdf,
    CannotOpenThePrintDialog,
    CannotShowCaptions,
    CannotOpenCaptionWindow,
    CannotCloseCaptions,
    CannotCheckLocalDrafts,
    InvalidDraftIdentifier,
    CannotCheckStorageCleanup,
    CannotFinishStorageCleanup,
    CannotBeginDeletion,
    CannotDeleteCourseDataFilesWillBeRestored,
    CannotDeleteCourseDocuments,
    CannotDeleteCourses,
    CannotClearModelRecords,
    CannotCommitDeletion,
    CannotCommitDeletionFilesWillBeRestored,
    CannotBeginLectureDeletion,
    CannotDeleteLectureDataFilesWillBeRestored,
    CannotDeleteLecture,
    CannotCommitLectureDeletion,
    CannotCommitLectureDeletionFilesWillBeRestored,
    CannotReadCourse,
    CannotReadCourseData,
    CannotSaveCourse,
    CannotDeleteCourse,
    CannotReadTrash,
    CannotRestoreCourse,
    CannotReadGlossary,
    CannotDeleteGlossary,
    CannotReadLiveCaptions,
    CannotReadTranscript,
    CannotSaveTranscript,
    CannotSaveTranscriptSegments,
    CannotSaveTranscriptionProgress,
    CannotCommitTranscriptSegments,
    CannotSaveTranslation,
    CannotReadRecoveryRecord,
    CannotSaveAudioSource,
    CannotCreateTheRecordingFolderCheckPermissions,
    CannotSaveLecture,
    CannotReadLecture,
    CannotReadLectureData,
    CannotSaveLectureStatus,
    CannotOpenTheLocalDatabase,
    CannotInitializeTheDatabase,
    CannotReadDatabaseVersion,
    CannotStartDatabaseMigration,
    CannotSaveDatabaseVersion,
    CannotCommitDatabaseMigration,
    CannotStartClassroomMigration,
    CannotCommitClassroomMigration,
    CannotStartStudyWorkspaceMigration,
    CannotCommitStudyWorkspaceMigration,
    CannotPrepareReliabilityMigration,
    CannotStartReliabilityMigration,
    CannotVerifyMigration,
    CannotCommitReliabilityMigration,
    CannotEnableDatabaseIntegrityChecks,
    CannotRepairImportMetadata,
    CannotRecoverProcessingTasks,
    CannotSaveModelMetadata,
    CannotRemoveModelMetadata,
    CannotReadSettings,
    CannotEncodeSettings,
    CannotSaveSettings,
    CannotReadSavedReviews,
    CannotReadReviewProgress,
    CannotReadSavedReview,
    CannotEncodeReviewProgress,
    CannotSaveReviewProgressPreviouslySavedSectionsAre,
    CannotPublishReview,
    InvalidReviewProgress,
    CannotPublishReviewVersion,
    CannotEncodePublishedReview,
    CannotSavePublishedReview,
    CannotCommitPublishedReview,
    CannotSaveProcessingTaskNoRequestWasSent,
    CannotSaveTaskProgress,
    CannotSaveTaskOutcome,
    CannotReadProcessingHistory,
    CannotReadTasks,
    InvalidTranslationResult,
    CannotSaveNoteVersion,
    CannotClearDraft,
    CannotSaveBookmark,
    CannotRemoveBookmark,
    CannotReadCourseDocuments,
    CannotReadDocuments,
    CannotSaveCourseDocument,
    CannotReadBookmarks,
    CannotReadNoteHistory,
    CannotReadDraft,
    CannotSavePin,
    CannotSearchLibrary,
    ModelManagerUnavailable,
    CannotInitializeModelDownload,
    CannotCreateModelFolder,
    CannotDownloadModelCheckYourConnection,
    ModelDownloadUnavailable,
    CannotCreateModelFileCheckDiskSpace,
    CannotWriteModelCheckDiskSpace,
    CannotSaveModel,
    CannotInstallModel,
    CannotSaveModelLicenseReinstallLecturerelay,
    CannotRemoveModel,
    CannotCheckLocalModelProcess,
    LocalTokenizerUnavailable,
    InvalidLocalTokenCount,
    CannotReadLocalModelCheckDiskSpaceAnd,
    InvalidLocalAiRuntimeManifest,
    InvalidRuntimeManifest,
    InvalidRuntimeFileName,
    InvalidRuntimeChecksum,
    CannotAllocateALocalAiConnection,
    CannotReadLocalAiConnection,
    CannotInitializeLocalAi,
    CannotInitializeLocalAiClient,
    CannotStartLocalAiReinstallLecturerelay,
    UnsupportedTranslationLanguage,
    CannotInitializeASecureConnection,
    CannotReachTheProviderCheckYourNetworkConnection,
    CannotEncodeAudioUpload,
    CannotEncodeTranslationInput,
    LiveCaptionStatusUnavailable,
    DiagnosticsUnavailable,
    LiveStatusUnavailable,
    UnsupportedLiveAudioFormat,
    CannotReadLiveAudioCheckpoint,
    CannotReadLiveAudioRecordingContinues,
    SpeechProviderUnavailable,
    CannotEncodeDiagnostics,
    CannotInspectStorageForCleanupCheckPermissions,
    CannotInspectStorage,
    CannotInspectCleanupRecovery,
    CannotRestoreInterruptedCleanup,
    CannotRestoreFilesAfterInterruptedCleanup,
    CannotFinishCleanupRecovery,
    CannotReadCleanupJournal,
    InvalidCleanupJournal,
    InvalidCleanupJournalName,
    InvalidCleanupDestination,
    InvalidCourse,
    InvalidLecture,
    CannotInspectCourseFiles,
    CannotPrepareCleanupJournal,
    CannotLocateTheWindowsAppDataFolder,
    CannotLocateTheWindowsDocumentsFolder,
    CannotCreateTheAppDataFolderCheckPermissions,
    CannotCreateTheLibraryFolderCheckDocumentsPermissions,
    InvalidCourseOrLectureIdentifier,
    CannotCreateTheLectureFolder,
    CannotEncodeLectureMetadata,
    CannotEncodeTranscript,
    InvalidLocalFilePath,
    CannotWriteALocalFileCheckDiskSpace,
    CannotWriteTheFileCheckAvailableDiskSpace,
    CannotSaveFile,
    CannotUpdateTheFileCheckWhetherAnotherApp,
    CannotSaveLectureSnapshot,
    StorageUsageIsUnavailableCheckFolderPermissions,
    CannotReadAvailableCpuResources,
    CannotManageLocalSpeechPerformance,
    CannotCheckLocalSpeechWorker,
    CannotChangeLocalSpeechPerformance,
    InvalidLocalSpeechAudio,
    UnsupportedLocalSpeechAudio,
    CannotReadLocalSpeechAudio,
    LocalRecognitionUnavailable,
    LocalSpeechWorkerUnavailable,
    CannotStartLocalSpeechRecognitionReinstallLecturerelay,
    LocalSpeechInputUnavailable,
    LocalSpeechOutputUnavailable,
    CannotSetSpeechGlossary,
    InvalidLocalStreamingResponse,
    InvalidLocalSpeechChunk,
    CannotContainLocalSpeechWorker,
    ALiveSummaryIsBeingProcessedWaitFor,
    WaitForTheModelDownloadToFinish,
    WaitForTheFiveSecondAudioTestTo,
    ChooseAValidSummaryServiceModelAndAn,
    BeforeEnablingCloudSummariesAllowTheSelectedProvider,
    CannotReadLiveSummarySettings,
    CannotSaveLiveSummarySettings,
    CannotTurnOffTheOldLocalLiveSummary,
    SummaryProcessingWasInterruptedTheSourceTextIs,
    AnotherSummaryIsBeingProcessedPleaseWait,
    CannotReadTheSummaryRateLimitStatus,
    TheSummaryServiceIsStillRateLimitedRecording,
    TheSummaryFormatIsIncompleteTryAgainIncomplete,
    TheSummaryLengthOrCitationsAreInvalidTry,
    TheSummaryCitesSourceTextThatDoesNot,
    SetUpAndEnableLiveSummariesFirst,
    SaveAndTestAnApiKeyInLive,
    ASummaryIsStillUnfinishedRetryItOn,
    ThereIsNoNewlyFinalizedEnglishYetTry,
    TheSummaryWasCancelledOrItsSettingsChanged,
    TheSummaryTimedOutTheSourceTextIs,
    SummaryCardNotFound,
    TheSourceTextWasNotFound,
    TheRecordingCannotBeReadRightNowTry,
    ThisRecordingFormatDoesNotSupportSectionPlayback,
    ThisPartOfTheRecordingIsNotFinished,
    CannotLocateTheRecordingSection,
    ReadingTheRecordingSectionFailedTryAgainLater,
    CannotReadTheRecordingSection,
    SaveTheApiKeyThenSelectTestSummary,
    TheSummaryConnectionTestTimedOutCheckYour,
    TheKeyOrSummarySettingsChangedDuringThe,
    CannotOpenThisServicePage,
    CannotOpenTheSystemBrowserCheckYourDefault,
    TheSourceTextOrAssistanceLanguageChangedSummarize,
    ThereIsNoNewlyFinalizedEnglishYet,
    TheSummarySourcesAreDuplicatedSelectThemAgain,
    TheSourceTextChangedTryAgain,
    ThisSourceTextAlreadyHasASummaryCheck,
    ThisSummaryCardWasNotFound,
    ThisSectionIsBeingSummarizedPleaseWait,
    TheSourceTextWasDeletedSoThisSummary,
    TheSourceTextChangedSoTheOldResult,
    TheApiKeyIsInvalidOrRevokedReplace,
    AccountBalanceOrApiBillingIsNotReady,
    TheAccountLacksAccessCheckTheServiceRegion,
    TheSelectedModelIsUnavailableChooseAnotherModel,
    TheFreeAllowanceIsUsedUpOrRequests,
    TheModelDoesNotSupportTheseSummaryParameters,
    TheProviderIsTemporarilyUnavailableTheSourceText,
    TheSummaryRequestDidNotCompleteCheckThe,
    CannotReachTheSummaryServiceOrTheRequest,
    TheSummaryDidNotFinishBeforeTheApp,
    ATranscriptIsNeededToAnswerFromLecture,
    CannotReadSummaryLanguage,
    CannotCheckSummaryReferences,
    CannotReadLiveSummaries,
    CannotReadSavedSummaryCards,
    CannotMarkAnOutdatedSummary,
    CannotReserveASummary,
    CannotCheckSummaryCoverage,
    CannotCheckSavedSummarySources,
    CannotEncodeSummarySources,
    CannotSaveSummaryInputNoRequestWasSent,
    CannotSaveSummaryInput,
    CannotRetrySummary,
    CannotSaveLiveSummary,
    CannotEncodeSummary,
    CannotSaveSummaryOutcome,
    CannotSaveConnectionTest,
    CannotClearConnectionTest,
    CannotReadConnectionTest,
    AppClosedBeforeProcessingFinishedSavedResultsAre,
    CannotStartLiveSummaryMigration,
    LiveSummaryMigrationFailed,
    CannotCommitLiveSummaryMigration,
    CannotRecoverLiveSummaries,
    CannotPrepareLanguageMigration,
    CannotStartLanguageMigration,
    LanguageMigrationFailed,
    LanguageMigrationFailedItsIntegrityCheck,
    CannotCommitLanguageMigration,
    CannotStartSpeakerMigration,
    SpeakerMigrationFailed,
    CannotCommitSpeakerMigration,
    CannotStartArchiveMigration,
    ArchiveMigrationFailed,
    CannotCommitArchiveMigration,
    CannotArchiveCourse,
    SpeakerNameIsEmptyOrTooLong,
    CannotSaveSpeaker,
    CannotReadSpeakers,
    DownloadTheSpeakerModelFirst,
    TranscribeBeforeDetectingSpeakers,
    SpeakerDetectionFailedTranscriptIsUnchanged,
    CannotSwitchAudioDeviceTheCurrentOneKeepsRecording,
    EnterAnHttpsLinkToAnAudioOrVideoFile,
    CannotDownloadThatLinkCheckItAndYourConnection,
    ThatLinkOpensWebPageNotMediaFile,
    MediaDownloadWasInterruptedTryAgain,
    ModelRequired,
}
impl ErrorCode {
    pub fn message(self) -> &'static str {
        match self {
            Self::NotesAreTooLongShortenThemBeforeSaving => {
                "Notes are too long. Shorten them before saving."
            }
            Self::CannotReadNotes => "Cannot read notes.",
            Self::CannotSaveNotes => "Cannot save notes.",
            Self::CannotReadAnswers => "Cannot read answers.",
            Self::CannotEncodeAnswerSources => "Cannot encode answer sources.",
            Self::CannotSaveAnswers => "Cannot save answers.",
            Self::TheAnswerSourcesIsDamaged => "The answer sources is damaged.",
            Self::OperationFailed => "Operation did not complete. Try again.",
            Self::LiveTranslationPreviewSuperseded => "Live translation preview superseded.",
            Self::LiveTranslationQueueUnavailable => "Live translation queue unavailable.",
            Self::TypeDeleteToConfirmPermanentDeletion => {
                "Type DELETE to confirm permanent deletion."
            }
            Self::TypeDeleteAllToConfirmFreeingAllClass => {
                "Type DELETE ALL to confirm freeing all class storage."
            }
            Self::CannotSafelyStartLocalSpeechWorker => "Cannot safely start local speech worker.",
            Self::StopAndSaveTheRecordingBeforeTranscription => {
                "Stop and save the recording before transcription."
            }
            Self::AudioCannotBeReadTheRecordingMayNot => {
                "Audio cannot be read. The recording may not have completed normally."
            }
            Self::ThisRecordingFormatIsNotSupportedForTranscription => {
                "This recording format is not supported for transcription."
            }
            Self::InvalidTranscriptionTimestampsOrTextSavedContentIs => {
                "Invalid transcription timestamps or text. Saved content is preserved."
            }
            Self::NoEnglishSegmentsNeedTranslation => "No English segments need translation.",
            Self::SomeTranslationsAreMissingEnglishIsPreservedRun => {
                "Some translations are missing. English is preserved; run translation again."
            }
            Self::TranscriptOrTargetLanguageChangedOldTranslationsWere => {
                "Transcript or target language changed. Old translations were discarded."
            }
            Self::EnterAQuestionOfNoMoreThan2 => {
                "Enter a question of no more than 2,000 characters."
            }
            Self::SplitLongTranscriptSegmentsIntoShorterSectionsBefore => {
                "Split long transcript segments into shorter sections before asking a question."
            }
            Self::ChooseASubtitleLanguage => "Choose a subtitle language.",
            Self::NoSubtitlesAreAvailableInThisLanguage => {
                "No subtitles are available in this language."
            }
            Self::AnotherAiTaskIsRunningWaitOrCancel => {
                "Another AI task is running. Wait or cancel it."
            }
            Self::TaskCancelledSavedResultsArePreserved => {
                "Task cancelled. Saved results are preserved."
            }
            Self::TheLocalPdfIsMissingOrUnreadable => "The local PDF is missing or unreadable.",
            Self::ChooseAValidPdfSmallerThan50Mib => "Choose a valid PDF smaller than 50 MiB.",
            Self::ChooseAMediaFileSmallerThan2Gib => "Choose a media file smaller than 2 GiB.",
            Self::ThisMediaFormatIsUnsupportedOrDamaged => {
                "This media format is unsupported or damaged."
            }
            Self::NoSupportedAudioTrackWasFound => "No supported audio track was found.",
            Self::UnknownAudioSampleRate => "Unknown audio sample rate.",
            Self::ThisAudioCodecIsUnsupported => "This audio codec is unsupported.",
            Self::MediaDecodingFailedTheOriginalFileWasNot => {
                "Media decoding failed. The original file was not changed."
            }
            Self::AudioIsDamagedOrUsesAnUnsupportedCodec => {
                "Audio is damaged or uses an unsupported codec."
            }
            Self::ChangingAudioFormatIsUnsupported => "Changing audio format is unsupported.",
            Self::MediaExceedsTheFiveHourImportLimit => "Media exceeds the five-hour import limit.",
            Self::TheSelectedFileContainsNoDecodableAudio => {
                "The selected file contains no decodable audio."
            }
            Self::TheAudioTrackEndedUnexpectedlyOriginalMediaIs => {
                "The audio track ended unexpectedly. Original media is preserved."
            }
            Self::TheTranscriptCourseContextLanguageOrModelChanged => {
                "The transcript, course context, language or model changed. Saved sections remain available; start a new review to use the current source."
            }
            Self::KeepReviewInstructionsUnder2000Characters => {
                "Keep review instructions under 2,000 characters."
            }
            Self::AddOrGenerateATranscriptFirst => "Add or generate a transcript first.",
            Self::ReviewAssemblyIsIncomplete => "Review assembly is incomplete.",
            Self::ASmallReviewSectionStillExceedsTheModel => {
                "A small review section still exceeds the model limit. Saved sections are preserved; retry or simplify the requested focus."
            }
            Self::SourceCoverageIsIncomplete => "Source coverage is incomplete.",
            Self::LocalAiReachedItsOutputLimitCompletedReview => {
                "Local AI reached its output limit. Completed review sections are saved; retry the remaining work."
            }
            Self::TheAudioDeviceReportedADiscontinuityCheckThe => {
                "The audio device reported a discontinuity. Check the recording; the device did not report how much audio was affected."
            }
            Self::TheAudioDeviceReturnedAnInvalidFormat => {
                "The audio device returned an invalid format."
            }
            Self::InvalidAudioDeviceSelectItAgain => "Invalid audio device. Select it again.",
            Self::ThisAudioFormatIsUnsupportedChooseAnotherDevice => {
                "This audio format is unsupported. Choose another device."
            }
            Self::AudioDeviceDisconnectedDuringTheTest => {
                "Audio device disconnected during the test."
            }
            Self::AnotherLectureIsRecordingStopItFirst => {
                "Another lecture is recording. Stop it first."
            }
            Self::AudioStartupTimedOutCheckTheDeviceAnd => {
                "Audio startup timed out. Check the device and permissions."
            }
            Self::ThisLectureIsNotRecording => "This lecture is not recording.",
            Self::RecordingStoppedSaveTheLecture => "Recording stopped. Save the lecture.",
            Self::RecordingAlreadyStopped => "Recording already stopped.",
            Self::RecordingWorkerFailedRestartToRecoverSavedAudio => {
                "Recording worker failed. Restart to recover saved audio."
            }
            Self::NoAudioDeviceFoundConnectItAndCheck => {
                "No audio device found. Connect it and check Windows audio permissions."
            }
            Self::AudioDeviceUnavailableConnectItAndRefreshDevices => {
                "Audio device unavailable. Connect it and refresh devices."
            }
            Self::SelectedAudioDevice => "Selected audio device",
            Self::ThisAudioSampleFormatIsUnsupportedChooseAnother => {
                "This audio sample format is unsupported. Choose another device."
            }
            Self::RecordingStartupCancelled => "Recording startup cancelled.",
            Self::AudioDeviceDisconnectedOrUnavailableEarlierAudioIs => {
                "Audio device disconnected or unavailable. Earlier audio is preserved."
            }
            Self::NoSoundDetectedCheckTheAudioSourceAnd => {
                "No sound detected. Check the audio source and volume."
            }
            Self::RecordingCouldNotFinishNormallySavedAudioWill => {
                "Recording could not finish normally. Saved audio will be recovered on restart."
            }
            Self::WaitForLiveCaptionProcessingToFinish => {
                "Wait for live caption processing to finish."
            }
            Self::StopRecordingThisCourseFirst => "Stop recording this course first.",
            Self::ATaskIsRunningForThisCourseCancel => {
                "A task is running for this course. Cancel it or wait for completion."
            }
            Self::ChooseAValidAudioSourceAndDevice => "Choose a valid audio source and device.",
            Self::AnAudioTestIsAlreadyRunningItFinishes => {
                "An audio test is already running. It finishes after five seconds."
            }
            Self::DownloadTheLocalSpeechModelInSettingsAi => {
                "Download the local speech model in Settings → AI & models → Local models before class."
            }
            Self::AddYourSpeechProviderKeyInSettingsBefore => {
                "Add your speech provider key in Settings before class."
            }
            Self::AnotherLectureIsRecordingOpenThatLectureTo => {
                "Another lecture is recording. Open that lecture to stop it."
            }
            Self::ThisRecordingIsNotActiveRestartToRecover => {
                "This recording is not active. Restart to recover its saved audio."
            }
            Self::StopAndSaveTheLectureFirst => "Stop and save the lecture first.",
            Self::StopAndSaveTheRecordingFirst => "Stop and save the recording first.",
            Self::DescribeWhatYouWantToReview => "Describe what you want to review.",
            Self::ThisLectureHasNoNotesYet => "This lecture has no notes yet.",
            Self::StorageUsageIsUnavailable => "Storage usage is unavailable.",
            Self::LectureDeletionWasInterruptedRestartToRecoverCleanup => {
                "Lecture deletion was interrupted. Restart to recover cleanup."
            }
            Self::PermanentDeletionWasInterruptedRestartToRecoverCleanup => {
                "Permanent deletion was interrupted. Restart to recover cleanup."
            }
            Self::StorageCleanupWasInterruptedRestartToRecoverCleanup => {
                "Storage cleanup was interrupted. Restart to recover cleanup."
            }
            Self::MediaImportCouldNotFinish => "Media import could not finish.",
            Self::CourseDocumentNotFound => "Course document not found.",
            Self::StopAndSaveRecordingBeforeCancellingFinalProcessing => {
                "Stop and save recording before cancelling final processing."
            }
            Self::TooManyDraftIdentifiers => "Too many draft identifiers.",
            Self::LectureNotFoundFilesWillBeRestored => {
                "Lecture not found. Files will be restored."
            }
            Self::ContentDeletedButDatabaseCompactionFailedRestartThe => {
                "Content deleted, but database compaction failed. Restart the app and try freeing storage again."
            }
            Self::TheCourseDoesNotExist => "The course does not exist.",
            Self::EnterAValidCourseNameSubjectAndAssistance => {
                "Enter a valid course name, subject and assistance language."
            }
            Self::TheGlossaryTermIsEmptyOrTooLong => "The glossary term is empty or too long.",
            Self::TheGlossaryDoesNotExist => "The glossary does not exist.",
            Self::CannotSaveThisEnglishTermMayAlreadyExist => {
                "Cannot save: this English term may already exist."
            }
            Self::TranscriptDataIsDamaged => "Transcript data is damaged.",
            Self::CheckTranscriptContentAndTimestamps => "Check transcript content and timestamps.",
            Self::TranscriptSegmentDoesNotExist => "Transcript segment does not exist.",
            Self::TheRecoveryRecordIsDamaged => "The recovery record is damaged.",
            Self::EnterAValidLectureTitle => "Enter a valid lecture title.",
            Self::TheLectureDoesNotExist => "The lecture does not exist.",
            Self::ThisDatabaseRequiresANewerLecturerelayVersionUpgrade => {
                "This database requires a newer LectureRelay version. Upgrade the app."
            }
            Self::DatabaseMigrationFailed => "Database migration failed.",
            Self::ClassroomMigrationFailed => "Classroom migration failed.",
            Self::StudyWorkspaceMigrationFailed => "Study workspace migration failed.",
            Self::ReliabilityMigrationFailed => "Reliability migration failed.",
            Self::ReliabilityMigrationFailedItsIntegrityCheckExistingDatabase => {
                "Reliability migration failed its integrity check. Existing database was preserved."
            }
            Self::DatabaseUnavailableRestartTheApp => "Database unavailable. Restart the app.",
            Self::ChooseASupportedLocalTranslationModel => {
                "Choose a supported local translation model."
            }
            Self::CheckYourLanguageProviderAndCaptionPreferencesKeep => {
                "Check your language, provider and caption preferences. Keep at least one caption language visible."
            }
            Self::SavedSettingsCouldNotBeRead => "Saved settings could not be read.",
            Self::SavedReviewProgressIsInvalid => "Saved review progress is invalid.",
            Self::SavedReviewNotFound => "Saved review not found.",
            Self::ReviewExceedsTheSupportedSizeSavedSectionsRemain => {
                "Review exceeds the supported size. Saved sections remain available."
            }
            Self::AllSourceSectionsCoveredSavedAsANew => {
                "All source sections covered. Saved as a new note version."
            }
            Self::ProcessingFailedSavedAudioAndCompletedResultsAre => {
                "Processing failed. Saved audio and completed results are preserved."
            }
            Self::CancelledSavedResultsArePreserved => "Cancelled. Saved results are preserved.",
            Self::ProcessingWasInterruptedResumeFromSavedResults => {
                "Processing was interrupted. Resume from saved results."
            }
            Self::NotesExceedTheSupportedSize => "Notes exceed the supported size.",
            Self::DraftExceedsTheSupportedSize => "Draft exceeds the supported size.",
            Self::DraftCouldNotBeSavedKeepThisWindow => {
                "Draft could not be saved. Keep this window open."
            }
            Self::ChooseAValidTimestampAndAShortLabel => {
                "Choose a valid timestamp and a short label."
            }
            Self::UnknownLocalModel => "Unknown local model.",
            Self::ModelDownloadInterruptedTryAgain => "Model download interrupted. Try again.",
            Self::ModelExceedsTheExpectedSize => "Model exceeds the expected size.",
            Self::ModelDownloadCancelled => "Model download cancelled.",
            Self::ModelIntegrityCheckFailedDownloadAgain => {
                "Model integrity check failed. Download again."
            }
            Self::ModelDownloadInsideAnotherApp => {
                "LectureRelay was started from another app, which would store this download separately. Open LectureRelay from the Start menu to download models."
            }
            Self::AuthorizationRejectedCheckYourApiKeyAndAccount => {
                "Authorization rejected. Check your API key and account permissions."
            }
            Self::ModelOrEndpointUnavailableCheckTheModelName => {
                "Model or endpoint unavailable. Check the model name."
            }
            Self::AudioChunkExceedsTheProviderLimit => "Audio chunk exceeds the provider limit.",
            Self::ProviderQuotaOrRateLimitReachedTryAgain => {
                "Provider quota or rate limit reached. Try again later."
            }
            Self::ProviderUnavailableTryAgainLater => "Provider unavailable. Try again later.",
            Self::TheProviderCouldNotProcessThisRequestCheck => {
                "The provider could not process this request. Check the model, account and input."
            }
            Self::ProviderResponseInterruptedTryAgain => {
                "Provider response interrupted. Try again."
            }
            Self::ProviderResponseExceedsTheSizeLimit => {
                "Provider response exceeds the size limit."
            }
            Self::ProviderResponseCouldNotBeParsed => "Provider response could not be parsed.",
            Self::ThisTextExceedsTheLocalModelContextShorten => {
                "This text exceeds the local model context. Shorten the requested focus or course background."
            }
            Self::ThisAiFeatureIsOffChooseAModel => {
                "This AI feature is off. Choose a model in Settings → AI & models."
            }
            Self::LocalTranslationCancelledRecordingIsPreserved => {
                "Local translation cancelled. Recording is preserved."
            }
            Self::LiveTranslationPausedEnglishAndAudioAreSaved => {
                "Live translation paused. English and audio are saved; translate missing sentences after class."
            }
            Self::TranslationDeferredWhileEnglishCaptionsCatchUpSaved => {
                "Translation deferred while English captions catch up. Saved text can be translated after class."
            }
            Self::CheckingAndLoadingLocalModel => "Checking and loading local model…",
            Self::LocalAiCouldNotLoadTheModelCheck => {
                "Local AI could not load the model. Check available memory or reinstall the model. Recording is preserved."
            }
            Self::LocalModelLoadingTimedOutRecordingIsPreserved => {
                "Local model loading timed out. Recording is preserved."
            }
            Self::GeneratingOnThisComputer => "Generating on this computer…",
            Self::LocalAiRequestFailedSavedAudioAndText => {
                "Local AI request failed. Saved audio and text are preserved; retry or choose a smaller task."
            }
            Self::LocalAiResponseExceedsTheLimit => "Local AI response exceeds the limit.",
            Self::LocalAiReturnedInvalidData => "Local AI returned invalid data.",
            Self::LocalAiDidNotCompleteItsResponseSaved => {
                "Local AI did not complete its response. Saved results are preserved."
            }
            Self::LocalAiReturnedNoTextTryAgain => "Local AI returned no text. Try again.",
            Self::LocalAiConnectionStoppedOrTimedOutRecording => {
                "Local AI connection stopped or timed out. Recording and saved results are preserved."
            }
            Self::LocalModelOrRuntimeIsMissingDownloadAgain => {
                "Local model or runtime is missing. Download again or reinstall the app."
            }
            Self::LocalModelIntegrityCheckFailedRemoveItAnd => {
                "Local model integrity check failed. Remove it and download again."
            }
            Self::LocalAiRuntimeMissingReinstallLecturerelay => {
                "Local AI runtime missing. Reinstall LectureRelay."
            }
            Self::UseLocalEnglishForTranscription => "Use Local English for transcription.",
            Self::CloudAiReachedItsOutputLimitCompletedReview => {
                "Cloud AI reached its output limit. Completed review sections are saved; retry the remaining work."
            }
            Self::TheProviderDidNotCompleteItsResponseSaved => {
                "The provider did not complete its response. Saved results are preserved."
            }
            Self::TheProviderReturnedNoValidTextCheckThe => {
                "The provider returned no valid text. Check the model configuration."
            }
            Self::ProviderTextExceedsTheSizeLimit => "Provider text exceeds the size limit.",
            Self::AddAKeyForThisProviderInSettings => "Add a key for this provider in Settings.",
            Self::InvalidApiKeyFormatAddTheKeyAgain => "Invalid API key format. Add the key again.",
            Self::ConnectedButThisTextModelIsUnavailableCheck => {
                "Connected, but this text model is unavailable. Check the model and account permissions."
            }
            Self::AiRequestFailedOrTimedOutCheckYour => {
                "AI request failed or timed out. Check your network and try again."
            }
            Self::TranscriptionFailedOrTimedOutSavedAudioIs => {
                "Transcription failed or timed out. Saved audio is preserved."
            }
            Self::InvalidTimestampsInTheProviderResponse => {
                "Invalid timestamps in the provider response."
            }
            Self::TheProviderReturnedNoTranscript => "The provider returned no transcript.",
            Self::InvalidTranslationResponseEnglishIsPreservedTryTranslation => {
                "Invalid translation response. English is preserved; try translation again."
            }
            Self::PasteAValidApiKeyWithoutSpacesOr => {
                "Paste a valid API key without spaces or newlines."
            }
            Self::WindowsCredentialManagerCouldNotSaveTheKey => {
                "Windows Credential Manager could not save the key."
            }
            Self::TheSavedKeyIsEmptyAddItAgain => "The saved key is empty. Add it again.",
            Self::TheSavedKeyCannotBeReadAddIt => "The saved key cannot be read. Add it again.",
            Self::WindowsCredentialManagerCouldNotReadTheKey => {
                "Windows Credential Manager could not read the key."
            }
            Self::WindowsCredentialManagerCouldNotRemoveTheKey => {
                "Windows Credential Manager could not remove the key."
            }
            Self::ChooseAnAiProviderAndAddAKey => {
                "Choose an AI provider and add a key in Settings."
            }
            Self::DownloadTheLocalSpeechModelInSettingsFirst => {
                "Download the local speech model in Settings first."
            }
            Self::LiveTranslationTimedOutEnglishIsPreserved => {
                "Live translation timed out. English is preserved."
            }
            Self::EnglishCaptionsAreBehindAudioIsStillBeing => {
                "English captions are behind. Audio is still being saved. Try Full performance; remaining text can be transcribed after class."
            }
            Self::LiveTranscriptionTimedOutRecordingContinues => {
                "Live transcription timed out. Recording continues."
            }
            Self::InvalidLiveSpeechResponseAudioIsPreserved => {
                "Invalid live speech response. Audio is preserved."
            }
            Self::SomeTranslationsNeedAnotherTryYourEnglishAnd => {
                "Some translations need another try. Your English and audio are saved; retry from lecture replay."
            }
            Self::InvalidCleanupPathNothingWasDeleted => {
                "Invalid cleanup path. Nothing was deleted."
            }
            Self::StorageContainsALinkOrJunctionCleanupWas => {
                "Storage contains a link or junction. Cleanup was stopped to protect files outside LectureRelay."
            }
            Self::InvalidCleanupScopeFilesWerePreserved => {
                "Invalid cleanup scope. Files were preserved."
            }
            Self::ContentWasDeletedButSomeFilesCouldNot => {
                "Content was deleted, but some files could not be freed. Restart LectureRelay to retry cleanup."
            }
            Self::CleanupRecoveryFoundConflictingFilesKeepBothFolders => {
                "Cleanup recovery found conflicting files. Keep both folders and restart after resolving the conflict."
            }
            Self::MoveThisCourseToTrashBeforeDeletingIt => {
                "Move this course to Trash before deleting it permanently."
            }
            Self::StopAndSaveThisLectureBeforeDeletingIt => {
                "Stop and save this lecture before deleting it."
            }
            Self::CleanupDestinationAlreadyExists => "Cleanup destination already exists.",
            Self::CannotFreeStorageWhileFilesAreInUse => {
                "Cannot free storage while files are in use. Close external players and try again."
            }
            Self::TheTestDataFolderMustBeAnAbsolute => {
                "The test data folder must be an absolute path."
            }
            Self::LecturerelayIsAlreadyRunningOrTheAppData => {
                "LectureRelay is already running, or the app data folder is not writable."
            }
            Self::SpeechPreferencesAreBusy => "Speech preferences are busy.",
            Self::LocalRecognitionStoppedRecordingIsPreserved => {
                "Local recognition stopped. Recording is preserved."
            }
            Self::LocalSpeechResponseExceedsTheLimit => "Local speech response exceeds the limit.",
            Self::LocalSpeechResponseInterrupted => "Local speech response interrupted.",
            Self::LocalRecognitionFailedRecordingIsPreservedTranscribeAfter => {
                "Local recognition failed. Recording is preserved; transcribe after class."
            }
            Self::LocalSpeechReturnedInvalidText => "Local speech returned invalid text.",
            Self::LocalRecognitionTimedOutRecordingContinuesTranscribeAfter => {
                "Local recognition timed out. Recording continues; transcribe after class."
            }
            Self::LocalSpeechStopped => "Local speech stopped.",
            Self::CannotResumeTranscription => "Cannot resume transcription.",
            Self::CannotReadRecording => "Cannot read recording.",
            Self::TaskStatusUnavailable => "Task status unavailable.",
            Self::CannotInspectPdf => "Cannot inspect PDF.",
            Self::CannotReadPdf => "Cannot read PDF.",
            Self::CannotReadTheSelectedMediaFile => "Cannot read the selected media file.",
            Self::CannotInspectMedia => "Cannot inspect media.",
            Self::UnsupportedAudioSampleRate => "Unsupported audio sample rate.",
            Self::CannotCreateImportedAudioCheckDiskSpace => {
                "Cannot create imported audio. Check disk space."
            }
            Self::CannotWriteImportedAudioCheckDiskSpace => {
                "Cannot write imported audio. Check disk space."
            }
            Self::CannotSaveImportedAudio => "Cannot save imported audio.",
            Self::CannotFinalizeImportedAudio => "Cannot finalize imported audio.",
            Self::CannotIdentifyReviewSource => "Cannot identify review source.",
            Self::CannotListAudioDevicesCheckWindowsPermissions => {
                "Cannot list audio devices. Check Windows permissions."
            }
            Self::CannotStartAudioCaptureCheckWindowsAudioPermissions => {
                "Cannot start audio capture. Check Windows audio permissions or choose another device."
            }
            Self::CannotOpenThisAudioInputCheckWindowsAudio => {
                "Cannot open this audio input. Check Windows audio permissions."
            }
            Self::CannotStartTheAudioTestCloseAppsHolding => {
                "Cannot start the audio test. Close apps holding the device."
            }
            Self::RecordingStatusUnavailable => "Recording status unavailable.",
            Self::CannotStartTheRecordingWorker => "Cannot start the recording worker.",
            Self::CannotOpenTheAudioDeviceCheckTheDevice => {
                "Cannot open the audio device. Check the device and Windows permissions."
            }
            Self::CannotCreateTheRecordingFileCheckDiskSpace => {
                "Cannot create the recording file. Check disk space and permissions."
            }
            Self::CannotInitializeTheRecordingFile => "Cannot initialize the recording file.",
            Self::CannotInitializeWavRecording => "Cannot initialize WAV recording.",
            Self::CannotSaveTheWavHeader => "Cannot save the WAV header.",
            Self::CannotStartAudioCaptureCloseAppsHoldingThe => {
                "Cannot start audio capture. Close apps holding the device."
            }
            Self::CannotResumeTheAudioDeviceEarlierAudioIs => {
                "Cannot resume the audio device. Earlier audio is preserved."
            }
            Self::CannotWriteAudioCheckAvailableDiskSpace => {
                "Cannot write audio. Check available disk space."
            }
            Self::CannotSaveAudioCheckAvailableDiskSpace => {
                "Cannot save audio. Check available disk space."
            }
            Self::CannotSaveTheRecoveryCheckpointCheckAvailableDisk => {
                "Cannot save the recovery checkpoint. Check available disk space."
            }
            Self::CannotSaveTheEndOfTheRecording => "Cannot save the end of the recording.",
            Self::CannotEncodeAudioChunk => "Cannot encode audio chunk.",
            Self::CannotCheckAudioDevices => "Cannot check audio devices.",
            Self::CannotTestTheAudioInput => "Cannot test the audio input.",
            Self::CannotStartLectureRecording => "Cannot start lecture recording.",
            Self::CannotSaveTheLectureWrittenAudioIsPreserved => {
                "Cannot save the lecture. Written audio is preserved."
            }
            Self::InvalidSubtitleFormat => "Invalid subtitle format.",
            Self::CannotEncodeTranscriptExport => "Cannot encode transcript export.",
            Self::UnsupportedExportFormat => "Unsupported export format.",
            Self::InvalidStorageFolder => "Invalid storage folder.",
            Self::CannotOpenFileExplorer => "Cannot open File Explorer.",
            Self::CannotListAudioDevices => "Cannot list audio devices.",
            Self::ModelStatusUnavailable => "Model status unavailable.",
            Self::CannotCreateCourseDocumentsFolder => "Cannot create course documents folder.",
            Self::CannotAttachCoursePdf => "Cannot attach course PDF.",
            Self::CannotReadCoursePdf => "Cannot read course PDF.",
            Self::CannotOpenThePrintDialog => "Cannot open the print dialog.",
            Self::CannotShowCaptions => "Cannot show captions.",
            Self::CannotOpenCaptionWindow => "Cannot open caption window.",
            Self::CannotCloseCaptions => "Cannot close captions.",
            Self::CannotCheckLocalDrafts => "Cannot check local drafts.",
            Self::InvalidDraftIdentifier => "Invalid draft identifier.",
            Self::CannotCheckStorageCleanup => "Cannot check storage cleanup.",
            Self::CannotFinishStorageCleanup => "Cannot finish storage cleanup.",
            Self::CannotBeginDeletion => "Cannot begin deletion.",
            Self::CannotDeleteCourseDataFilesWillBeRestored => {
                "Cannot delete course data. Files will be restored."
            }
            Self::CannotDeleteCourseDocuments => "Cannot delete course documents.",
            Self::CannotDeleteCourses => "Cannot delete courses.",
            Self::CannotClearModelRecords => "Cannot clear model records.",
            Self::CannotCommitDeletion => "Cannot commit deletion.",
            Self::CannotCommitDeletionFilesWillBeRestored => {
                "Cannot commit deletion. Files will be restored."
            }
            Self::CannotBeginLectureDeletion => "Cannot begin lecture deletion.",
            Self::CannotDeleteLectureDataFilesWillBeRestored => {
                "Cannot delete lecture data. Files will be restored."
            }
            Self::CannotDeleteLecture => "Cannot delete lecture.",
            Self::CannotCommitLectureDeletion => "Cannot commit lecture deletion.",
            Self::CannotCommitLectureDeletionFilesWillBeRestored => {
                "Cannot commit lecture deletion. Files will be restored."
            }
            Self::CannotReadCourse => "Cannot read course.",
            Self::CannotReadCourseData => "Cannot read course data.",
            Self::CannotSaveCourse => "Cannot save course.",
            Self::CannotDeleteCourse => "Cannot delete course.",
            Self::CannotReadTrash => "Cannot read Trash.",
            Self::CannotRestoreCourse => "Cannot restore course.",
            Self::CannotReadGlossary => "Cannot read glossary.",
            Self::CannotDeleteGlossary => "Cannot delete glossary.",
            Self::CannotReadLiveCaptions => "Cannot read live captions.",
            Self::CannotReadTranscript => "Cannot read transcript.",
            Self::CannotSaveTranscript => "Cannot save transcript.",
            Self::CannotSaveTranscriptSegments => "Cannot save transcript segments.",
            Self::CannotSaveTranscriptionProgress => "Cannot save transcription progress.",
            Self::CannotCommitTranscriptSegments => "Cannot commit transcript segments.",
            Self::CannotSaveTranslation => "Cannot save translation.",
            Self::CannotReadRecoveryRecord => "Cannot read recovery record.",
            Self::CannotSaveAudioSource => "Cannot save audio source.",
            Self::CannotCreateTheRecordingFolderCheckPermissions => {
                "Cannot create the recording folder. Check permissions."
            }
            Self::CannotSaveLecture => "Cannot save lecture.",
            Self::CannotReadLecture => "Cannot read lecture.",
            Self::CannotReadLectureData => "Cannot read lecture data.",
            Self::CannotSaveLectureStatus => "Cannot save lecture status.",
            Self::CannotOpenTheLocalDatabase => "Cannot open the local database.",
            Self::CannotInitializeTheDatabase => "Cannot initialize the database.",
            Self::CannotReadDatabaseVersion => "Cannot read database version.",
            Self::CannotStartDatabaseMigration => "Cannot start database migration.",
            Self::CannotSaveDatabaseVersion => "Cannot save database version.",
            Self::CannotCommitDatabaseMigration => "Cannot commit database migration.",
            Self::CannotStartClassroomMigration => "Cannot start classroom migration.",
            Self::CannotCommitClassroomMigration => "Cannot commit classroom migration.",
            Self::CannotStartStudyWorkspaceMigration => "Cannot start study workspace migration.",
            Self::CannotCommitStudyWorkspaceMigration => "Cannot commit study workspace migration.",
            Self::CannotPrepareReliabilityMigration => "Cannot prepare reliability migration.",
            Self::CannotStartReliabilityMigration => "Cannot start reliability migration.",
            Self::CannotVerifyMigration => "Cannot verify migration.",
            Self::CannotCommitReliabilityMigration => "Cannot commit reliability migration.",
            Self::CannotEnableDatabaseIntegrityChecks => "Cannot enable database integrity checks.",
            Self::CannotRepairImportMetadata => "Cannot repair import metadata.",
            Self::CannotRecoverProcessingTasks => "Cannot recover processing tasks.",
            Self::CannotSaveModelMetadata => "Cannot save model metadata.",
            Self::CannotRemoveModelMetadata => "Cannot remove model metadata.",
            Self::CannotReadSettings => "Cannot read settings.",
            Self::CannotEncodeSettings => "Cannot encode settings.",
            Self::CannotSaveSettings => "Cannot save settings.",
            Self::CannotReadSavedReviews => "Cannot read saved reviews.",
            Self::CannotReadReviewProgress => "Cannot read review progress.",
            Self::CannotReadSavedReview => "Cannot read saved review.",
            Self::CannotEncodeReviewProgress => "Cannot encode review progress.",
            Self::CannotSaveReviewProgressPreviouslySavedSectionsAre => {
                "Cannot save review progress. Previously saved sections are preserved."
            }
            Self::CannotPublishReview => "Cannot publish review.",
            Self::InvalidReviewProgress => "Invalid review progress.",
            Self::CannotPublishReviewVersion => "Cannot publish review version.",
            Self::CannotEncodePublishedReview => "Cannot encode published review.",
            Self::CannotSavePublishedReview => "Cannot save published review.",
            Self::CannotCommitPublishedReview => "Cannot commit published review.",
            Self::CannotSaveProcessingTaskNoRequestWasSent => {
                "Cannot save processing task. No request was sent."
            }
            Self::CannotSaveTaskProgress => "Cannot save task progress.",
            Self::CannotSaveTaskOutcome => "Cannot save task outcome.",
            Self::CannotReadProcessingHistory => "Cannot read processing history.",
            Self::CannotReadTasks => "Cannot read tasks.",
            Self::InvalidTranslationResult => "Invalid translation result.",
            Self::CannotSaveNoteVersion => "Cannot save note version.",
            Self::CannotClearDraft => "Cannot clear draft.",
            Self::CannotSaveBookmark => "Cannot save bookmark.",
            Self::CannotRemoveBookmark => "Cannot remove bookmark.",
            Self::CannotReadCourseDocuments => "Cannot read course documents.",
            Self::CannotReadDocuments => "Cannot read documents.",
            Self::CannotSaveCourseDocument => "Cannot save course document.",
            Self::CannotReadBookmarks => "Cannot read bookmarks.",
            Self::CannotReadNoteHistory => "Cannot read note history.",
            Self::CannotReadDraft => "Cannot read draft.",
            Self::CannotSavePin => "Cannot save pin.",
            Self::CannotSearchLibrary => "Cannot search library.",
            Self::ModelManagerUnavailable => "Model manager unavailable.",
            Self::CannotInitializeModelDownload => "Cannot initialize model download.",
            Self::CannotCreateModelFolder => "Cannot create model folder.",
            Self::CannotDownloadModelCheckYourConnection => {
                "Cannot download model. Check your connection."
            }
            Self::ModelDownloadUnavailable => "Model download unavailable.",
            Self::CannotCreateModelFileCheckDiskSpace => {
                "Cannot create model file. Check disk space."
            }
            Self::CannotWriteModelCheckDiskSpace => "Cannot write model. Check disk space.",
            Self::CannotSaveModel => "Cannot save model.",
            Self::CannotInstallModel => "Cannot install model.",
            Self::CannotSaveModelLicenseReinstallLecturerelay => {
                "Cannot save model license. Reinstall LectureRelay."
            }
            Self::CannotRemoveModel => "Cannot remove model.",
            Self::CannotCheckLocalModelProcess => "Cannot check local model process.",
            Self::LocalTokenizerUnavailable => "Local tokenizer unavailable.",
            Self::InvalidLocalTokenCount => "Invalid local token count.",
            Self::CannotReadLocalModelCheckDiskSpaceAnd => {
                "Cannot read local model. Check disk space and permissions."
            }
            Self::InvalidLocalAiRuntimeManifest => "Invalid local AI runtime manifest.",
            Self::InvalidRuntimeManifest => "Invalid runtime manifest.",
            Self::InvalidRuntimeFileName => "Invalid runtime file name.",
            Self::InvalidRuntimeChecksum => "Invalid runtime checksum.",
            Self::CannotAllocateALocalAiConnection => "Cannot allocate a local AI connection.",
            Self::CannotReadLocalAiConnection => "Cannot read local AI connection.",
            Self::CannotInitializeLocalAi => "Cannot initialize local AI.",
            Self::CannotInitializeLocalAiClient => "Cannot initialize local AI client.",
            Self::CannotStartLocalAiReinstallLecturerelay => {
                "Cannot start local AI. Reinstall LectureRelay."
            }
            Self::UnsupportedTranslationLanguage => "Unsupported translation language.",
            Self::CannotInitializeASecureConnection => "Cannot initialize a secure connection.",
            Self::CannotReachTheProviderCheckYourNetworkConnection => {
                "Cannot reach the provider. Check your network connection."
            }
            Self::CannotEncodeAudioUpload => "Cannot encode audio upload.",
            Self::CannotEncodeTranslationInput => "Cannot encode translation input.",
            Self::LiveCaptionStatusUnavailable => "Live caption status unavailable.",
            Self::DiagnosticsUnavailable => "Diagnostics unavailable.",
            Self::LiveStatusUnavailable => "Live status unavailable.",
            Self::UnsupportedLiveAudioFormat => "Unsupported live audio format.",
            Self::CannotReadLiveAudioCheckpoint => "Cannot read live audio checkpoint.",
            Self::CannotReadLiveAudioRecordingContinues => {
                "Cannot read live audio. Recording continues."
            }
            Self::SpeechProviderUnavailable => "Speech provider unavailable.",
            Self::CannotEncodeDiagnostics => "Cannot encode diagnostics.",
            Self::CannotInspectStorageForCleanupCheckPermissions => {
                "Cannot inspect storage for cleanup. Check permissions."
            }
            Self::CannotInspectStorage => "Cannot inspect storage.",
            Self::CannotInspectCleanupRecovery => "Cannot inspect cleanup recovery.",
            Self::CannotRestoreInterruptedCleanup => "Cannot restore interrupted cleanup.",
            Self::CannotRestoreFilesAfterInterruptedCleanup => {
                "Cannot restore files after interrupted cleanup."
            }
            Self::CannotFinishCleanupRecovery => "Cannot finish cleanup recovery.",
            Self::CannotReadCleanupJournal => "Cannot read cleanup journal.",
            Self::InvalidCleanupJournal => "Invalid cleanup journal.",
            Self::InvalidCleanupJournalName => "Invalid cleanup journal name.",
            Self::InvalidCleanupDestination => "Invalid cleanup destination.",
            Self::InvalidCourse => "Invalid course.",
            Self::InvalidLecture => "Invalid lecture.",
            Self::CannotInspectCourseFiles => "Cannot inspect course files.",
            Self::CannotPrepareCleanupJournal => "Cannot prepare cleanup journal.",
            Self::CannotLocateTheWindowsAppDataFolder => {
                "Cannot locate the Windows app data folder."
            }
            Self::CannotLocateTheWindowsDocumentsFolder => {
                "Cannot locate the Windows Documents folder."
            }
            Self::CannotCreateTheAppDataFolderCheckPermissions => {
                "Cannot create the app data folder. Check permissions."
            }
            Self::CannotCreateTheLibraryFolderCheckDocumentsPermissions => {
                "Cannot create the library folder. Check Documents permissions."
            }
            Self::InvalidCourseOrLectureIdentifier => "Invalid course or lecture identifier.",
            Self::CannotCreateTheLectureFolder => "Cannot create the lecture folder.",
            Self::CannotEncodeLectureMetadata => "Cannot encode lecture metadata.",
            Self::CannotEncodeTranscript => "Cannot encode transcript.",
            Self::InvalidLocalFilePath => "Invalid local file path.",
            Self::CannotWriteALocalFileCheckDiskSpace => {
                "Cannot write a local file. Check disk space."
            }
            Self::CannotWriteTheFileCheckAvailableDiskSpace => {
                "Cannot write the file. Check available disk space."
            }
            Self::CannotSaveFile => "Cannot save file.",
            Self::CannotUpdateTheFileCheckWhetherAnotherApp => {
                "Cannot update the file. Check whether another app is using it."
            }
            Self::CannotSaveLectureSnapshot => "Cannot save lecture snapshot.",
            Self::StorageUsageIsUnavailableCheckFolderPermissions => {
                "Storage usage is unavailable. Check folder permissions."
            }
            Self::CannotReadAvailableCpuResources => "Cannot read available CPU resources.",
            Self::CannotManageLocalSpeechPerformance => "Cannot manage local speech performance.",
            Self::CannotCheckLocalSpeechWorker => "Cannot check local speech worker.",
            Self::CannotChangeLocalSpeechPerformance => "Cannot change local speech performance.",
            Self::InvalidLocalSpeechAudio => "Invalid local speech audio.",
            Self::UnsupportedLocalSpeechAudio => "Unsupported local speech audio.",
            Self::CannotReadLocalSpeechAudio => "Cannot read local speech audio.",
            Self::LocalRecognitionUnavailable => "Local recognition unavailable.",
            Self::LocalSpeechWorkerUnavailable => "Local speech worker unavailable.",
            Self::CannotStartLocalSpeechRecognitionReinstallLecturerelay => {
                "Cannot start local speech recognition. Reinstall LectureRelay."
            }
            Self::LocalSpeechInputUnavailable => "Local speech input unavailable.",
            Self::LocalSpeechOutputUnavailable => "Local speech output unavailable.",
            Self::CannotSetSpeechGlossary => "Cannot set speech glossary.",
            Self::InvalidLocalStreamingResponse => "Invalid local streaming response.",
            Self::InvalidLocalSpeechChunk => "Invalid local speech chunk.",
            Self::CannotContainLocalSpeechWorker => "Cannot contain local speech worker.",
            Self::ALiveSummaryIsBeingProcessedWaitFor => {
                "A live summary is being processed. Wait for it to finish or turn summaries off."
            }
            Self::WaitForTheModelDownloadToFinish => "Wait for the model download to finish.",
            Self::WaitForTheFiveSecondAudioTestTo => {
                "Wait for the five-second audio test to finish."
            }
            Self::ChooseAValidSummaryServiceModelAndAn => {
                "Choose a valid summary service, model and an interval of 2, 4 or 5 minutes."
            }
            Self::BeforeEnablingCloudSummariesAllowTheSelectedProvider => {
                "Before enabling cloud summaries, allow the selected provider to receive the matching English transcript and course background."
            }
            Self::CannotReadLiveSummarySettings => "Cannot read live summary settings.",
            Self::CannotSaveLiveSummarySettings => "Cannot save live summary settings.",
            Self::CannotTurnOffTheOldLocalLiveSummary => {
                "Cannot turn off the old local live summary setting."
            }
            Self::SummaryProcessingWasInterruptedTheSourceTextIs => {
                "Summary processing was interrupted. The source text is saved; retry on this card."
            }
            Self::AnotherSummaryIsBeingProcessedPleaseWait => {
                "Another summary is being processed. Please wait."
            }
            Self::CannotReadTheSummaryRateLimitStatus => {
                "Cannot read the summary rate-limit status."
            }
            Self::TheSummaryServiceIsStillRateLimitedRecording => {
                "The summary service is still rate limited. Recording and captions continue to be saved; try again later."
            }
            Self::TheSummaryFormatIsIncompleteTryAgainIncomplete => {
                "The summary format is incomplete. Try again; incomplete results are not shown as key points."
            }
            Self::TheSummaryLengthOrCitationsAreInvalidTry => {
                "The summary length or citations are invalid. Try again."
            }
            Self::TheSummaryCitesSourceTextThatDoesNot => {
                "The summary cites source text that does not exist. The source is preserved; try again."
            }
            Self::SetUpAndEnableLiveSummariesFirst => "Set up and enable live summaries first.",
            Self::SaveAndTestAnApiKeyInLive => {
                "Save and test an API key in live summary settings first. Recording and captions are not affected."
            }
            Self::ASummaryIsStillUnfinishedRetryItOn => {
                "A summary is still unfinished. Retry it on its card; new source text continues to be saved."
            }
            Self::ThereIsNoNewlyFinalizedEnglishYetTry => {
                "There is no newly finalized English yet. Try again later."
            }
            Self::TheSummaryWasCancelledOrItsSettingsChanged => {
                "The summary was cancelled or its settings changed. The unfinished section is kept; you can retry later."
            }
            Self::TheSummaryTimedOutTheSourceTextIs => {
                "The summary timed out. The source text is saved; you can retry later."
            }
            Self::SummaryCardNotFound => "Summary card not found.",
            Self::TheSourceTextWasNotFound => "The source text was not found.",
            Self::TheRecordingCannotBeReadRightNowTry => {
                "The recording cannot be read right now. Try again later."
            }
            Self::ThisRecordingFormatDoesNotSupportSectionPlayback => {
                "This recording format does not support section playback."
            }
            Self::ThisPartOfTheRecordingIsNotFinished => {
                "This part of the recording is not finished yet. Play it again later."
            }
            Self::CannotLocateTheRecordingSection => "Cannot locate the recording section.",
            Self::ReadingTheRecordingSectionFailedTryAgainLater => {
                "Reading the recording section failed. Try again later."
            }
            Self::CannotReadTheRecordingSection => "Cannot read the recording section.",
            Self::SaveTheApiKeyThenSelectTestSummary => {
                "Save the API key, then select Test summary connection; summaries can be enabled after it succeeds."
            }
            Self::TheSummaryConnectionTestTimedOutCheckYour => {
                "The summary connection test timed out. Check your network and try again."
            }
            Self::TheKeyOrSummarySettingsChangedDuringThe => {
                "The key or summary settings changed during the test. Test again."
            }
            Self::CannotOpenThisServicePage => "Cannot open this service page.",
            Self::CannotOpenTheSystemBrowserCheckYourDefault => {
                "Cannot open the system browser. Check your default browser setting."
            }
            Self::TheSourceTextOrAssistanceLanguageChangedSummarize => {
                "The source text or assistance language changed. Summarize again and review it."
            }
            Self::ThereIsNoNewlyFinalizedEnglishYet => "There is no newly finalized English yet.",
            Self::TheSummarySourcesAreDuplicatedSelectThemAgain => {
                "The summary sources are duplicated. Select them again."
            }
            Self::TheSourceTextChangedTryAgain => "The source text changed. Try again.",
            Self::ThisSourceTextAlreadyHasASummaryCheck => {
                "This source text already has a summary. Check the existing card or retry."
            }
            Self::ThisSummaryCardWasNotFound => "This summary card was not found.",
            Self::ThisSectionIsBeingSummarizedPleaseWait => {
                "This section is being summarized. Please wait."
            }
            Self::TheSourceTextWasDeletedSoThisSummary => {
                "The source text was deleted, so this summary cannot be retried."
            }
            Self::TheSourceTextChangedSoTheOldResult => {
                "The source text changed, so the old result was not used as the latest summary. Try again."
            }
            Self::TheApiKeyIsInvalidOrRevokedReplace => {
                "The API key is invalid or revoked. Replace it and test again."
            }
            Self::AccountBalanceOrApiBillingIsNotReady => {
                "Account balance or API billing is not ready. Check the provider account; recording continues to be saved."
            }
            Self::TheAccountLacksAccessCheckTheServiceRegion => {
                "The account lacks access. Check the service region, model permissions and account status."
            }
            Self::TheSelectedModelIsUnavailableChooseAnotherModel => {
                "The selected model is unavailable. Choose another model in advanced settings and test again."
            }
            Self::TheFreeAllowanceIsUsedUpOrRequests => {
                "The free allowance is used up or requests are limited. Check the account quota and try again later; recording continues to be saved."
            }
            Self::TheModelDoesNotSupportTheseSummaryParameters => {
                "The model does not support these summary parameters. Use the recommended model or check the advanced model settings."
            }
            Self::TheProviderIsTemporarilyUnavailableTheSourceText => {
                "The provider is temporarily unavailable. The source text is saved; try again later."
            }
            Self::TheSummaryRequestDidNotCompleteCheckThe => {
                "The summary request did not complete. Check the account and model settings. The source text is saved."
            }
            Self::CannotReachTheSummaryServiceOrTheRequest => {
                "Cannot reach the summary service or the request timed out. Check your network and try again; recording continues to be saved."
            }
            Self::TheSummaryDidNotFinishBeforeTheApp => {
                "The summary did not finish before the app closed. The source text is saved; you can retry it."
            }
            Self::ATranscriptIsNeededToAnswerFromLecture => {
                "A transcript is needed to answer from lecture evidence."
            }
            Self::CannotReadSummaryLanguage => "Cannot read summary language.",
            Self::CannotCheckSummaryReferences => "Cannot check summary references.",
            Self::CannotReadLiveSummaries => "Cannot read live summaries.",
            Self::CannotReadSavedSummaryCards => "Cannot read saved summary cards.",
            Self::CannotMarkAnOutdatedSummary => "Cannot mark an outdated summary.",
            Self::CannotReserveASummary => "Cannot reserve a summary.",
            Self::CannotCheckSummaryCoverage => "Cannot check summary coverage.",
            Self::CannotCheckSavedSummarySources => "Cannot check saved summary sources.",
            Self::CannotEncodeSummarySources => "Cannot encode summary sources.",
            Self::CannotSaveSummaryInputNoRequestWasSent => {
                "Cannot save summary input. No request was sent."
            }
            Self::CannotSaveSummaryInput => "Cannot save summary input.",
            Self::CannotRetrySummary => "Cannot retry summary.",
            Self::CannotSaveLiveSummary => "Cannot save live summary.",
            Self::CannotEncodeSummary => "Cannot encode summary.",
            Self::CannotSaveSummaryOutcome => "Cannot save summary outcome.",
            Self::CannotSaveConnectionTest => "Cannot save connection test.",
            Self::CannotClearConnectionTest => "Cannot clear connection test.",
            Self::CannotReadConnectionTest => "Cannot read connection test.",
            Self::AppClosedBeforeProcessingFinishedSavedResultsAre => {
                "App closed before processing finished. Saved results are preserved."
            }
            Self::CannotStartLiveSummaryMigration => "Cannot start live summary migration.",
            Self::LiveSummaryMigrationFailed => "Live summary migration failed.",
            Self::CannotCommitLiveSummaryMigration => "Cannot commit live summary migration.",
            Self::CannotRecoverLiveSummaries => "Cannot recover live summaries.",
            Self::CannotPrepareLanguageMigration => {
                "Cannot prepare translation language migration."
            }
            Self::CannotStartLanguageMigration => "Cannot start translation language migration.",
            Self::LanguageMigrationFailed => "Translation language migration failed.",
            Self::LanguageMigrationFailedItsIntegrityCheck => {
                "Translation language migration failed its integrity check. Existing database was preserved."
            }
            Self::CannotCommitLanguageMigration => "Cannot commit translation language migration.",
            Self::CannotStartSpeakerMigration => "Cannot start speaker label migration.",
            Self::SpeakerMigrationFailed => "Speaker label migration failed.",
            Self::CannotCommitSpeakerMigration => "Cannot commit speaker label migration.",
            Self::CannotStartArchiveMigration => "Cannot start course archive migration.",
            Self::ArchiveMigrationFailed => "Course archive migration failed.",
            Self::CannotCommitArchiveMigration => "Cannot commit course archive migration.",
            Self::CannotArchiveCourse => "Cannot archive the course.",
            Self::SpeakerNameIsEmptyOrTooLong => "Enter a speaker name of up to 40 characters.",
            Self::CannotSaveSpeaker => "Cannot save the speaker.",
            Self::CannotReadSpeakers => "Cannot read speakers.",
            Self::DownloadTheSpeakerModelFirst => {
                "Download the speaker model in Settings → AI & models → Local models first."
            }
            Self::TranscribeBeforeDetectingSpeakers => {
                "Transcribe the lecture before detecting speakers."
            }
            Self::SpeakerDetectionFailedTranscriptIsUnchanged => {
                "Speaker detection failed. The transcript is unchanged."
            }
            Self::EnterAnHttpsLinkToAnAudioOrVideoFile => {
                "Enter an https link to an audio or video file."
            }
            Self::CannotDownloadThatLinkCheckItAndYourConnection => {
                "Cannot download that link. Check the link and your connection."
            }
            Self::ThatLinkOpensWebPageNotMediaFile => {
                "That link opens a web page, not an audio or video file. Video sites such as YouTube are not supported."
            }
            Self::MediaDownloadWasInterruptedTryAgain => "The download was interrupted. Try again.",
            Self::CannotSwitchAudioDeviceTheCurrentOneKeepsRecording => {
                "Cannot switch to that device. Recording continues on the current one."
            }
            Self::ModelRequired => "",
        }
    }
    pub fn from_legacy(message: &str) -> Self {
        match message {
            "Notes are too long. Shorten them before saving." => {
                Self::NotesAreTooLongShortenThemBeforeSaving
            }
            "Cannot read notes." => Self::CannotReadNotes,
            "Cannot save notes." => Self::CannotSaveNotes,
            "Cannot read answers." => Self::CannotReadAnswers,
            "Cannot encode answer sources." => Self::CannotEncodeAnswerSources,
            "Cannot save answers." => Self::CannotSaveAnswers,
            "The answer sources is damaged." => Self::TheAnswerSourcesIsDamaged,
            "Operation did not complete. Try again." => Self::OperationFailed,
            "Live translation preview superseded." => Self::LiveTranslationPreviewSuperseded,
            "Live translation queue unavailable." => Self::LiveTranslationQueueUnavailable,
            "Type DELETE to confirm permanent deletion." => {
                Self::TypeDeleteToConfirmPermanentDeletion
            }
            "Type DELETE ALL to confirm freeing all class storage." => {
                Self::TypeDeleteAllToConfirmFreeingAllClass
            }
            "Cannot safely start local speech worker." => Self::CannotSafelyStartLocalSpeechWorker,
            "Stop and save the recording before transcription." => {
                Self::StopAndSaveTheRecordingBeforeTranscription
            }
            "Audio cannot be read. The recording may not have completed normally." => {
                Self::AudioCannotBeReadTheRecordingMayNot
            }
            "This recording format is not supported for transcription." => {
                Self::ThisRecordingFormatIsNotSupportedForTranscription
            }
            "Invalid transcription timestamps or text. Saved content is preserved." => {
                Self::InvalidTranscriptionTimestampsOrTextSavedContentIs
            }
            "No English segments need translation." => Self::NoEnglishSegmentsNeedTranslation,
            "Some translations are missing. English is preserved; run translation again." => {
                Self::SomeTranslationsAreMissingEnglishIsPreservedRun
            }
            "Transcript or target language changed. Old translations were discarded." => {
                Self::TranscriptOrTargetLanguageChangedOldTranslationsWere
            }
            "Enter a question of no more than 2,000 characters." => {
                Self::EnterAQuestionOfNoMoreThan2
            }
            "Split long transcript segments into shorter sections before asking a question." => {
                Self::SplitLongTranscriptSegmentsIntoShorterSectionsBefore
            }
            "Choose a subtitle language." => Self::ChooseASubtitleLanguage,
            "No subtitles are available in this language." => {
                Self::NoSubtitlesAreAvailableInThisLanguage
            }
            "Another AI task is running. Wait or cancel it." => {
                Self::AnotherAiTaskIsRunningWaitOrCancel
            }
            "Task cancelled. Saved results are preserved." => {
                Self::TaskCancelledSavedResultsArePreserved
            }
            "The local PDF is missing or unreadable." => Self::TheLocalPdfIsMissingOrUnreadable,
            "Choose a valid PDF smaller than 50 MiB." => Self::ChooseAValidPdfSmallerThan50Mib,
            "Choose a media file smaller than 2 GiB." => Self::ChooseAMediaFileSmallerThan2Gib,
            "This media format is unsupported or damaged." => {
                Self::ThisMediaFormatIsUnsupportedOrDamaged
            }
            "No supported audio track was found." => Self::NoSupportedAudioTrackWasFound,
            "Unknown audio sample rate." => Self::UnknownAudioSampleRate,
            "This audio codec is unsupported." => Self::ThisAudioCodecIsUnsupported,
            "Media decoding failed. The original file was not changed." => {
                Self::MediaDecodingFailedTheOriginalFileWasNot
            }
            "Audio is damaged or uses an unsupported codec." => {
                Self::AudioIsDamagedOrUsesAnUnsupportedCodec
            }
            "Changing audio format is unsupported." => Self::ChangingAudioFormatIsUnsupported,
            "Media exceeds the five-hour import limit." => Self::MediaExceedsTheFiveHourImportLimit,
            "The selected file contains no decodable audio." => {
                Self::TheSelectedFileContainsNoDecodableAudio
            }
            "The audio track ended unexpectedly. Original media is preserved." => {
                Self::TheAudioTrackEndedUnexpectedlyOriginalMediaIs
            }
            "The transcript, course context, language or model changed. Saved sections remain available; start a new review to use the current source." => {
                Self::TheTranscriptCourseContextLanguageOrModelChanged
            }
            "Keep review instructions under 2,000 characters." => {
                Self::KeepReviewInstructionsUnder2000Characters
            }
            "Add or generate a transcript first." => Self::AddOrGenerateATranscriptFirst,
            "Review assembly is incomplete." => Self::ReviewAssemblyIsIncomplete,
            "A small review section still exceeds the model limit. Saved sections are preserved; retry or simplify the requested focus." => {
                Self::ASmallReviewSectionStillExceedsTheModel
            }
            "Source coverage is incomplete." => Self::SourceCoverageIsIncomplete,
            "Local AI reached its output limit. Completed review sections are saved; retry the remaining work." => {
                Self::LocalAiReachedItsOutputLimitCompletedReview
            }
            "The audio device reported a discontinuity. Check the recording; the device did not report how much audio was affected." => {
                Self::TheAudioDeviceReportedADiscontinuityCheckThe
            }
            "The audio device returned an invalid format." => {
                Self::TheAudioDeviceReturnedAnInvalidFormat
            }
            "Invalid audio device. Select it again." => Self::InvalidAudioDeviceSelectItAgain,
            "This audio format is unsupported. Choose another device." => {
                Self::ThisAudioFormatIsUnsupportedChooseAnotherDevice
            }
            "Audio device disconnected during the test." => {
                Self::AudioDeviceDisconnectedDuringTheTest
            }
            "Another lecture is recording. Stop it first." => {
                Self::AnotherLectureIsRecordingStopItFirst
            }
            "Audio startup timed out. Check the device and permissions." => {
                Self::AudioStartupTimedOutCheckTheDeviceAnd
            }
            "This lecture is not recording." => Self::ThisLectureIsNotRecording,
            "Recording stopped. Save the lecture." => Self::RecordingStoppedSaveTheLecture,
            "Recording already stopped." => Self::RecordingAlreadyStopped,
            "Recording worker failed. Restart to recover saved audio." => {
                Self::RecordingWorkerFailedRestartToRecoverSavedAudio
            }
            "No audio device found. Connect it and check Windows audio permissions." => {
                Self::NoAudioDeviceFoundConnectItAndCheck
            }
            "Audio device unavailable. Connect it and refresh devices." => {
                Self::AudioDeviceUnavailableConnectItAndRefreshDevices
            }
            "Selected audio device" => Self::SelectedAudioDevice,
            "This audio sample format is unsupported. Choose another device." => {
                Self::ThisAudioSampleFormatIsUnsupportedChooseAnother
            }
            "Recording startup cancelled." => Self::RecordingStartupCancelled,
            "Audio device disconnected or unavailable. Earlier audio is preserved." => {
                Self::AudioDeviceDisconnectedOrUnavailableEarlierAudioIs
            }
            "No sound detected. Check the audio source and volume." => {
                Self::NoSoundDetectedCheckTheAudioSourceAnd
            }
            "Recording could not finish normally. Saved audio will be recovered on restart." => {
                Self::RecordingCouldNotFinishNormallySavedAudioWill
            }
            "Wait for live caption processing to finish." => {
                Self::WaitForLiveCaptionProcessingToFinish
            }
            "Stop recording this course first." => Self::StopRecordingThisCourseFirst,
            "A task is running for this course. Cancel it or wait for completion." => {
                Self::ATaskIsRunningForThisCourseCancel
            }
            "Choose a valid audio source and device." => Self::ChooseAValidAudioSourceAndDevice,
            "An audio test is already running. It finishes after five seconds." => {
                Self::AnAudioTestIsAlreadyRunningItFinishes
            }
            "Download the local speech model in Settings → AI & models → Local models before class." => {
                Self::DownloadTheLocalSpeechModelInSettingsAi
            }
            "Add your speech provider key in Settings before class." => {
                Self::AddYourSpeechProviderKeyInSettingsBefore
            }
            "Another lecture is recording. Open that lecture to stop it." => {
                Self::AnotherLectureIsRecordingOpenThatLectureTo
            }
            "This recording is not active. Restart to recover its saved audio." => {
                Self::ThisRecordingIsNotActiveRestartToRecover
            }
            "Stop and save the lecture first." => Self::StopAndSaveTheLectureFirst,
            "Stop and save the recording first." => Self::StopAndSaveTheRecordingFirst,
            "Describe what you want to review." => Self::DescribeWhatYouWantToReview,
            "This lecture has no notes yet." => Self::ThisLectureHasNoNotesYet,
            "Storage usage is unavailable." => Self::StorageUsageIsUnavailable,
            "Lecture deletion was interrupted. Restart to recover cleanup." => {
                Self::LectureDeletionWasInterruptedRestartToRecoverCleanup
            }
            "Permanent deletion was interrupted. Restart to recover cleanup." => {
                Self::PermanentDeletionWasInterruptedRestartToRecoverCleanup
            }
            "Storage cleanup was interrupted. Restart to recover cleanup." => {
                Self::StorageCleanupWasInterruptedRestartToRecoverCleanup
            }
            "Media import could not finish." => Self::MediaImportCouldNotFinish,
            "Course document not found." => Self::CourseDocumentNotFound,
            "Stop and save recording before cancelling final processing." => {
                Self::StopAndSaveRecordingBeforeCancellingFinalProcessing
            }
            "Too many draft identifiers." => Self::TooManyDraftIdentifiers,
            "Lecture not found. Files will be restored." => {
                Self::LectureNotFoundFilesWillBeRestored
            }
            "Content deleted, but database compaction failed. Restart the app and try freeing storage again." => {
                Self::ContentDeletedButDatabaseCompactionFailedRestartThe
            }
            "The course does not exist." => Self::TheCourseDoesNotExist,
            "Enter a valid course name, subject and assistance language." => {
                Self::EnterAValidCourseNameSubjectAndAssistance
            }
            "The glossary term is empty or too long." => Self::TheGlossaryTermIsEmptyOrTooLong,
            "The glossary does not exist." => Self::TheGlossaryDoesNotExist,
            "Cannot save: this English term may already exist." => {
                Self::CannotSaveThisEnglishTermMayAlreadyExist
            }
            "Transcript data is damaged." => Self::TranscriptDataIsDamaged,
            "Check transcript content and timestamps." => Self::CheckTranscriptContentAndTimestamps,
            "Transcript segment does not exist." => Self::TranscriptSegmentDoesNotExist,
            "The recovery record is damaged." => Self::TheRecoveryRecordIsDamaged,
            "Enter a valid lecture title." => Self::EnterAValidLectureTitle,
            "The lecture does not exist." => Self::TheLectureDoesNotExist,
            "This database requires a newer LectureRelay version. Upgrade the app." => {
                Self::ThisDatabaseRequiresANewerLecturerelayVersionUpgrade
            }
            "Database migration failed." => Self::DatabaseMigrationFailed,
            "Classroom migration failed." => Self::ClassroomMigrationFailed,
            "Study workspace migration failed." => Self::StudyWorkspaceMigrationFailed,
            "Reliability migration failed." => Self::ReliabilityMigrationFailed,
            "Reliability migration failed its integrity check. Existing database was preserved." => {
                Self::ReliabilityMigrationFailedItsIntegrityCheckExistingDatabase
            }
            "Database unavailable. Restart the app." => Self::DatabaseUnavailableRestartTheApp,
            "Choose a supported local translation model." => {
                Self::ChooseASupportedLocalTranslationModel
            }
            "Check your language, provider and caption preferences. Keep at least one caption language visible." => {
                Self::CheckYourLanguageProviderAndCaptionPreferencesKeep
            }
            "Saved settings could not be read." => Self::SavedSettingsCouldNotBeRead,
            "Saved review progress is invalid." => Self::SavedReviewProgressIsInvalid,
            "Saved review not found." => Self::SavedReviewNotFound,
            "Review exceeds the supported size. Saved sections remain available." => {
                Self::ReviewExceedsTheSupportedSizeSavedSectionsRemain
            }
            "All source sections covered. Saved as a new note version." => {
                Self::AllSourceSectionsCoveredSavedAsANew
            }
            "Processing failed. Saved audio and completed results are preserved." => {
                Self::ProcessingFailedSavedAudioAndCompletedResultsAre
            }
            "Cancelled. Saved results are preserved." => Self::CancelledSavedResultsArePreserved,
            "Processing was interrupted. Resume from saved results." => {
                Self::ProcessingWasInterruptedResumeFromSavedResults
            }
            "Notes exceed the supported size." => Self::NotesExceedTheSupportedSize,
            "Draft exceeds the supported size." => Self::DraftExceedsTheSupportedSize,
            "Draft could not be saved. Keep this window open." => {
                Self::DraftCouldNotBeSavedKeepThisWindow
            }
            "Choose a valid timestamp and a short label." => {
                Self::ChooseAValidTimestampAndAShortLabel
            }
            "Unknown local model." => Self::UnknownLocalModel,
            "Model download interrupted. Try again." => Self::ModelDownloadInterruptedTryAgain,
            "Model exceeds the expected size." => Self::ModelExceedsTheExpectedSize,
            "Model download cancelled." => Self::ModelDownloadCancelled,
            "Model integrity check failed. Download again." => {
                Self::ModelIntegrityCheckFailedDownloadAgain
            }
            "LectureRelay was started from another app, which would store this download separately. Open LectureRelay from the Start menu to download models." => {
                Self::ModelDownloadInsideAnotherApp
            }
            "Authorization rejected. Check your API key and account permissions." => {
                Self::AuthorizationRejectedCheckYourApiKeyAndAccount
            }
            "Model or endpoint unavailable. Check the model name." => {
                Self::ModelOrEndpointUnavailableCheckTheModelName
            }
            "Audio chunk exceeds the provider limit." => Self::AudioChunkExceedsTheProviderLimit,
            "Provider quota or rate limit reached. Try again later." => {
                Self::ProviderQuotaOrRateLimitReachedTryAgain
            }
            "Provider unavailable. Try again later." => Self::ProviderUnavailableTryAgainLater,
            "The provider could not process this request. Check the model, account and input." => {
                Self::TheProviderCouldNotProcessThisRequestCheck
            }
            "Provider response interrupted. Try again." => {
                Self::ProviderResponseInterruptedTryAgain
            }
            "Provider response exceeds the size limit." => {
                Self::ProviderResponseExceedsTheSizeLimit
            }
            "Provider response could not be parsed." => Self::ProviderResponseCouldNotBeParsed,
            "This text exceeds the local model context. Shorten the requested focus or course background." => {
                Self::ThisTextExceedsTheLocalModelContextShorten
            }
            "This AI feature is off. Choose a model in Settings → AI & models." => {
                Self::ThisAiFeatureIsOffChooseAModel
            }
            "Local translation cancelled. Recording is preserved." => {
                Self::LocalTranslationCancelledRecordingIsPreserved
            }
            "Live translation paused. English and audio are saved; translate missing sentences after class." => {
                Self::LiveTranslationPausedEnglishAndAudioAreSaved
            }
            "Translation deferred while English captions catch up. Saved text can be translated after class." => {
                Self::TranslationDeferredWhileEnglishCaptionsCatchUpSaved
            }
            "Checking and loading local model…" => Self::CheckingAndLoadingLocalModel,
            "Local AI could not load the model. Check available memory or reinstall the model. Recording is preserved." => {
                Self::LocalAiCouldNotLoadTheModelCheck
            }
            "Local model loading timed out. Recording is preserved." => {
                Self::LocalModelLoadingTimedOutRecordingIsPreserved
            }
            "Generating on this computer…" => Self::GeneratingOnThisComputer,
            "Local AI request failed. Saved audio and text are preserved; retry or choose a smaller task." => {
                Self::LocalAiRequestFailedSavedAudioAndText
            }
            "Local AI response exceeds the limit." => Self::LocalAiResponseExceedsTheLimit,
            "Local AI returned invalid data." => Self::LocalAiReturnedInvalidData,
            "Local AI did not complete its response. Saved results are preserved." => {
                Self::LocalAiDidNotCompleteItsResponseSaved
            }
            "Local AI returned no text. Try again." => Self::LocalAiReturnedNoTextTryAgain,
            "Local AI connection stopped or timed out. Recording and saved results are preserved." => {
                Self::LocalAiConnectionStoppedOrTimedOutRecording
            }
            "Local model or runtime is missing. Download again or reinstall the app." => {
                Self::LocalModelOrRuntimeIsMissingDownloadAgain
            }
            "Local model integrity check failed. Remove it and download again." => {
                Self::LocalModelIntegrityCheckFailedRemoveItAnd
            }
            "Local AI runtime missing. Reinstall LectureRelay." => {
                Self::LocalAiRuntimeMissingReinstallLecturerelay
            }
            "Use Local English for transcription." => Self::UseLocalEnglishForTranscription,
            "Cloud AI reached its output limit. Completed review sections are saved; retry the remaining work." => {
                Self::CloudAiReachedItsOutputLimitCompletedReview
            }
            "The provider did not complete its response. Saved results are preserved." => {
                Self::TheProviderDidNotCompleteItsResponseSaved
            }
            "The provider returned no valid text. Check the model configuration." => {
                Self::TheProviderReturnedNoValidTextCheckThe
            }
            "Provider text exceeds the size limit." => Self::ProviderTextExceedsTheSizeLimit,
            "Add a key for this provider in Settings." => Self::AddAKeyForThisProviderInSettings,
            "Invalid API key format. Add the key again." => Self::InvalidApiKeyFormatAddTheKeyAgain,
            "Connected, but this text model is unavailable. Check the model and account permissions." => {
                Self::ConnectedButThisTextModelIsUnavailableCheck
            }
            "AI request failed or timed out. Check your network and try again." => {
                Self::AiRequestFailedOrTimedOutCheckYour
            }
            "Transcription failed or timed out. Saved audio is preserved." => {
                Self::TranscriptionFailedOrTimedOutSavedAudioIs
            }
            "Invalid timestamps in the provider response." => {
                Self::InvalidTimestampsInTheProviderResponse
            }
            "The provider returned no transcript." => Self::TheProviderReturnedNoTranscript,
            "Invalid translation response. English is preserved; try translation again." => {
                Self::InvalidTranslationResponseEnglishIsPreservedTryTranslation
            }
            "Paste a valid API key without spaces or newlines." => {
                Self::PasteAValidApiKeyWithoutSpacesOr
            }
            "Windows Credential Manager could not save the key." => {
                Self::WindowsCredentialManagerCouldNotSaveTheKey
            }
            "The saved key is empty. Add it again." => Self::TheSavedKeyIsEmptyAddItAgain,
            "The saved key cannot be read. Add it again." => Self::TheSavedKeyCannotBeReadAddIt,
            "Windows Credential Manager could not read the key." => {
                Self::WindowsCredentialManagerCouldNotReadTheKey
            }
            "Windows Credential Manager could not remove the key." => {
                Self::WindowsCredentialManagerCouldNotRemoveTheKey
            }
            "Choose an AI provider and add a key in Settings." => {
                Self::ChooseAnAiProviderAndAddAKey
            }
            "Download the local speech model in Settings first." => {
                Self::DownloadTheLocalSpeechModelInSettingsFirst
            }
            "Live translation timed out. English is preserved." => {
                Self::LiveTranslationTimedOutEnglishIsPreserved
            }
            "English captions are behind. Audio is still being saved. Try Full performance; remaining text can be transcribed after class." => {
                Self::EnglishCaptionsAreBehindAudioIsStillBeing
            }
            "Live transcription timed out. Recording continues." => {
                Self::LiveTranscriptionTimedOutRecordingContinues
            }
            "Invalid live speech response. Audio is preserved." => {
                Self::InvalidLiveSpeechResponseAudioIsPreserved
            }
            "Some translations need another try. Your English and audio are saved; retry from lecture replay." => {
                Self::SomeTranslationsNeedAnotherTryYourEnglishAnd
            }
            "Invalid cleanup path. Nothing was deleted." => {
                Self::InvalidCleanupPathNothingWasDeleted
            }
            "Storage contains a link or junction. Cleanup was stopped to protect files outside LectureRelay." => {
                Self::StorageContainsALinkOrJunctionCleanupWas
            }
            "Invalid cleanup scope. Files were preserved." => {
                Self::InvalidCleanupScopeFilesWerePreserved
            }
            "Content was deleted, but some files could not be freed. Restart LectureRelay to retry cleanup." => {
                Self::ContentWasDeletedButSomeFilesCouldNot
            }
            "Cleanup recovery found conflicting files. Keep both folders and restart after resolving the conflict." => {
                Self::CleanupRecoveryFoundConflictingFilesKeepBothFolders
            }
            "Move this course to Trash before deleting it permanently." => {
                Self::MoveThisCourseToTrashBeforeDeletingIt
            }
            "Stop and save this lecture before deleting it." => {
                Self::StopAndSaveThisLectureBeforeDeletingIt
            }
            "Cleanup destination already exists." => Self::CleanupDestinationAlreadyExists,
            "Cannot free storage while files are in use. Close external players and try again." => {
                Self::CannotFreeStorageWhileFilesAreInUse
            }
            "The test data folder must be an absolute path." => {
                Self::TheTestDataFolderMustBeAnAbsolute
            }
            "LectureRelay is already running, or the app data folder is not writable." => {
                Self::LecturerelayIsAlreadyRunningOrTheAppData
            }
            "Speech preferences are busy." => Self::SpeechPreferencesAreBusy,
            "Local recognition stopped. Recording is preserved." => {
                Self::LocalRecognitionStoppedRecordingIsPreserved
            }
            "Local speech response exceeds the limit." => Self::LocalSpeechResponseExceedsTheLimit,
            "Local speech response interrupted." => Self::LocalSpeechResponseInterrupted,
            "Local recognition failed. Recording is preserved; transcribe after class." => {
                Self::LocalRecognitionFailedRecordingIsPreservedTranscribeAfter
            }
            "Local speech returned invalid text." => Self::LocalSpeechReturnedInvalidText,
            "Local recognition timed out. Recording continues; transcribe after class." => {
                Self::LocalRecognitionTimedOutRecordingContinuesTranscribeAfter
            }
            "Local speech stopped." => Self::LocalSpeechStopped,
            "Cannot resume transcription." => Self::CannotResumeTranscription,
            "Cannot read recording." => Self::CannotReadRecording,
            "Task status unavailable." => Self::TaskStatusUnavailable,
            "Cannot inspect PDF." => Self::CannotInspectPdf,
            "Cannot read PDF." => Self::CannotReadPdf,
            "Cannot read the selected media file." => Self::CannotReadTheSelectedMediaFile,
            "Cannot inspect media." => Self::CannotInspectMedia,
            "Unsupported audio sample rate." => Self::UnsupportedAudioSampleRate,
            "Cannot create imported audio. Check disk space." => {
                Self::CannotCreateImportedAudioCheckDiskSpace
            }
            "Cannot write imported audio. Check disk space." => {
                Self::CannotWriteImportedAudioCheckDiskSpace
            }
            "Cannot save imported audio." => Self::CannotSaveImportedAudio,
            "Cannot finalize imported audio." => Self::CannotFinalizeImportedAudio,
            "Cannot identify review source." => Self::CannotIdentifyReviewSource,
            "Cannot list audio devices. Check Windows permissions." => {
                Self::CannotListAudioDevicesCheckWindowsPermissions
            }
            "Cannot start audio capture. Check Windows audio permissions or choose another device." => {
                Self::CannotStartAudioCaptureCheckWindowsAudioPermissions
            }
            "Cannot open this audio input. Check Windows audio permissions." => {
                Self::CannotOpenThisAudioInputCheckWindowsAudio
            }
            "Cannot start the audio test. Close apps holding the device." => {
                Self::CannotStartTheAudioTestCloseAppsHolding
            }
            "Recording status unavailable." => Self::RecordingStatusUnavailable,
            "Cannot start the recording worker." => Self::CannotStartTheRecordingWorker,
            "Cannot open the audio device. Check the device and Windows permissions." => {
                Self::CannotOpenTheAudioDeviceCheckTheDevice
            }
            "Cannot create the recording file. Check disk space and permissions." => {
                Self::CannotCreateTheRecordingFileCheckDiskSpace
            }
            "Cannot initialize the recording file." => Self::CannotInitializeTheRecordingFile,
            "Cannot initialize WAV recording." => Self::CannotInitializeWavRecording,
            "Cannot save the WAV header." => Self::CannotSaveTheWavHeader,
            "Cannot start audio capture. Close apps holding the device." => {
                Self::CannotStartAudioCaptureCloseAppsHoldingThe
            }
            "Cannot resume the audio device. Earlier audio is preserved." => {
                Self::CannotResumeTheAudioDeviceEarlierAudioIs
            }
            "Cannot write audio. Check available disk space." => {
                Self::CannotWriteAudioCheckAvailableDiskSpace
            }
            "Cannot save audio. Check available disk space." => {
                Self::CannotSaveAudioCheckAvailableDiskSpace
            }
            "Cannot save the recovery checkpoint. Check available disk space." => {
                Self::CannotSaveTheRecoveryCheckpointCheckAvailableDisk
            }
            "Cannot save the end of the recording." => Self::CannotSaveTheEndOfTheRecording,
            "Cannot encode audio chunk." => Self::CannotEncodeAudioChunk,
            "Cannot check audio devices." => Self::CannotCheckAudioDevices,
            "Cannot test the audio input." => Self::CannotTestTheAudioInput,
            "Cannot start lecture recording." => Self::CannotStartLectureRecording,
            "Cannot save the lecture. Written audio is preserved." => {
                Self::CannotSaveTheLectureWrittenAudioIsPreserved
            }
            "Invalid subtitle format." => Self::InvalidSubtitleFormat,
            "Cannot encode transcript export." => Self::CannotEncodeTranscriptExport,
            "Unsupported export format." => Self::UnsupportedExportFormat,
            "Invalid storage folder." => Self::InvalidStorageFolder,
            "Cannot open File Explorer." => Self::CannotOpenFileExplorer,
            "Cannot list audio devices." => Self::CannotListAudioDevices,
            "Model status unavailable." => Self::ModelStatusUnavailable,
            "Cannot create course documents folder." => Self::CannotCreateCourseDocumentsFolder,
            "Cannot attach course PDF." => Self::CannotAttachCoursePdf,
            "Cannot read course PDF." => Self::CannotReadCoursePdf,
            "Cannot open the print dialog." => Self::CannotOpenThePrintDialog,
            "Cannot show captions." => Self::CannotShowCaptions,
            "Cannot open caption window." => Self::CannotOpenCaptionWindow,
            "Cannot close captions." => Self::CannotCloseCaptions,
            "Cannot check local drafts." => Self::CannotCheckLocalDrafts,
            "Invalid draft identifier." => Self::InvalidDraftIdentifier,
            "Cannot check storage cleanup." => Self::CannotCheckStorageCleanup,
            "Cannot finish storage cleanup." => Self::CannotFinishStorageCleanup,
            "Cannot begin deletion." => Self::CannotBeginDeletion,
            "Cannot delete course data. Files will be restored." => {
                Self::CannotDeleteCourseDataFilesWillBeRestored
            }
            "Cannot delete course documents." => Self::CannotDeleteCourseDocuments,
            "Cannot delete courses." => Self::CannotDeleteCourses,
            "Cannot clear model records." => Self::CannotClearModelRecords,
            "Cannot commit deletion." => Self::CannotCommitDeletion,
            "Cannot commit deletion. Files will be restored." => {
                Self::CannotCommitDeletionFilesWillBeRestored
            }
            "Cannot begin lecture deletion." => Self::CannotBeginLectureDeletion,
            "Cannot delete lecture data. Files will be restored." => {
                Self::CannotDeleteLectureDataFilesWillBeRestored
            }
            "Cannot delete lecture." => Self::CannotDeleteLecture,
            "Cannot commit lecture deletion." => Self::CannotCommitLectureDeletion,
            "Cannot commit lecture deletion. Files will be restored." => {
                Self::CannotCommitLectureDeletionFilesWillBeRestored
            }
            "Cannot read course." => Self::CannotReadCourse,
            "Cannot read course data." => Self::CannotReadCourseData,
            "Cannot save course." => Self::CannotSaveCourse,
            "Cannot delete course." => Self::CannotDeleteCourse,
            "Cannot read Trash." => Self::CannotReadTrash,
            "Cannot restore course." => Self::CannotRestoreCourse,
            "Cannot read glossary." => Self::CannotReadGlossary,
            "Cannot delete glossary." => Self::CannotDeleteGlossary,
            "Cannot read live captions." => Self::CannotReadLiveCaptions,
            "Cannot read transcript." => Self::CannotReadTranscript,
            "Cannot save transcript." => Self::CannotSaveTranscript,
            "Cannot save transcript segments." => Self::CannotSaveTranscriptSegments,
            "Cannot save transcription progress." => Self::CannotSaveTranscriptionProgress,
            "Cannot commit transcript segments." => Self::CannotCommitTranscriptSegments,
            "Cannot save translation." => Self::CannotSaveTranslation,
            "Cannot read recovery record." => Self::CannotReadRecoveryRecord,
            "Cannot save audio source." => Self::CannotSaveAudioSource,
            "Cannot create the recording folder. Check permissions." => {
                Self::CannotCreateTheRecordingFolderCheckPermissions
            }
            "Cannot save lecture." => Self::CannotSaveLecture,
            "Cannot read lecture." => Self::CannotReadLecture,
            "Cannot read lecture data." => Self::CannotReadLectureData,
            "Cannot save lecture status." => Self::CannotSaveLectureStatus,
            "Cannot open the local database." => Self::CannotOpenTheLocalDatabase,
            "Cannot initialize the database." => Self::CannotInitializeTheDatabase,
            "Cannot read database version." => Self::CannotReadDatabaseVersion,
            "Cannot start database migration." => Self::CannotStartDatabaseMigration,
            "Cannot save database version." => Self::CannotSaveDatabaseVersion,
            "Cannot commit database migration." => Self::CannotCommitDatabaseMigration,
            "Cannot start classroom migration." => Self::CannotStartClassroomMigration,
            "Cannot commit classroom migration." => Self::CannotCommitClassroomMigration,
            "Cannot start study workspace migration." => Self::CannotStartStudyWorkspaceMigration,
            "Cannot commit study workspace migration." => Self::CannotCommitStudyWorkspaceMigration,
            "Cannot prepare reliability migration." => Self::CannotPrepareReliabilityMigration,
            "Cannot start reliability migration." => Self::CannotStartReliabilityMigration,
            "Cannot verify migration." => Self::CannotVerifyMigration,
            "Cannot commit reliability migration." => Self::CannotCommitReliabilityMigration,
            "Cannot enable database integrity checks." => Self::CannotEnableDatabaseIntegrityChecks,
            "Cannot repair import metadata." => Self::CannotRepairImportMetadata,
            "Cannot recover processing tasks." => Self::CannotRecoverProcessingTasks,
            "Cannot save model metadata." => Self::CannotSaveModelMetadata,
            "Cannot remove model metadata." => Self::CannotRemoveModelMetadata,
            "Cannot read settings." => Self::CannotReadSettings,
            "Cannot encode settings." => Self::CannotEncodeSettings,
            "Cannot save settings." => Self::CannotSaveSettings,
            "Cannot read saved reviews." => Self::CannotReadSavedReviews,
            "Cannot read review progress." => Self::CannotReadReviewProgress,
            "Cannot read saved review." => Self::CannotReadSavedReview,
            "Cannot encode review progress." => Self::CannotEncodeReviewProgress,
            "Cannot save review progress. Previously saved sections are preserved." => {
                Self::CannotSaveReviewProgressPreviouslySavedSectionsAre
            }
            "Cannot publish review." => Self::CannotPublishReview,
            "Invalid review progress." => Self::InvalidReviewProgress,
            "Cannot publish review version." => Self::CannotPublishReviewVersion,
            "Cannot encode published review." => Self::CannotEncodePublishedReview,
            "Cannot save published review." => Self::CannotSavePublishedReview,
            "Cannot commit published review." => Self::CannotCommitPublishedReview,
            "Cannot save processing task. No request was sent." => {
                Self::CannotSaveProcessingTaskNoRequestWasSent
            }
            "Cannot save task progress." => Self::CannotSaveTaskProgress,
            "Cannot save task outcome." => Self::CannotSaveTaskOutcome,
            "Cannot read processing history." => Self::CannotReadProcessingHistory,
            "Cannot read tasks." => Self::CannotReadTasks,
            "Invalid translation result." => Self::InvalidTranslationResult,
            "Cannot save note version." => Self::CannotSaveNoteVersion,
            "Cannot clear draft." => Self::CannotClearDraft,
            "Cannot save bookmark." => Self::CannotSaveBookmark,
            "Cannot remove bookmark." => Self::CannotRemoveBookmark,
            "Cannot read course documents." => Self::CannotReadCourseDocuments,
            "Cannot read documents." => Self::CannotReadDocuments,
            "Cannot save course document." => Self::CannotSaveCourseDocument,
            "Cannot read bookmarks." => Self::CannotReadBookmarks,
            "Cannot read note history." => Self::CannotReadNoteHistory,
            "Cannot read draft." => Self::CannotReadDraft,
            "Cannot save pin." => Self::CannotSavePin,
            "Cannot search library." => Self::CannotSearchLibrary,
            "Model manager unavailable." => Self::ModelManagerUnavailable,
            "Cannot initialize model download." => Self::CannotInitializeModelDownload,
            "Cannot create model folder." => Self::CannotCreateModelFolder,
            "Cannot download model. Check your connection." => {
                Self::CannotDownloadModelCheckYourConnection
            }
            "Model download unavailable." => Self::ModelDownloadUnavailable,
            "Cannot create model file. Check disk space." => {
                Self::CannotCreateModelFileCheckDiskSpace
            }
            "Cannot write model. Check disk space." => Self::CannotWriteModelCheckDiskSpace,
            "Cannot save model." => Self::CannotSaveModel,
            "Cannot install model." => Self::CannotInstallModel,
            "Cannot save model license. Reinstall LectureRelay." => {
                Self::CannotSaveModelLicenseReinstallLecturerelay
            }
            "Cannot remove model." => Self::CannotRemoveModel,
            "Cannot check local model process." => Self::CannotCheckLocalModelProcess,
            "Local tokenizer unavailable." => Self::LocalTokenizerUnavailable,
            "Invalid local token count." => Self::InvalidLocalTokenCount,
            "Cannot read local model. Check disk space and permissions." => {
                Self::CannotReadLocalModelCheckDiskSpaceAnd
            }
            "Invalid local AI runtime manifest." => Self::InvalidLocalAiRuntimeManifest,
            "Invalid runtime manifest." => Self::InvalidRuntimeManifest,
            "Invalid runtime file name." => Self::InvalidRuntimeFileName,
            "Invalid runtime checksum." => Self::InvalidRuntimeChecksum,
            "Cannot allocate a local AI connection." => Self::CannotAllocateALocalAiConnection,
            "Cannot read local AI connection." => Self::CannotReadLocalAiConnection,
            "Cannot initialize local AI." => Self::CannotInitializeLocalAi,
            "Cannot initialize local AI client." => Self::CannotInitializeLocalAiClient,
            "Cannot start local AI. Reinstall LectureRelay." => {
                Self::CannotStartLocalAiReinstallLecturerelay
            }
            "Unsupported translation language." => Self::UnsupportedTranslationLanguage,
            "Cannot initialize a secure connection." => Self::CannotInitializeASecureConnection,
            "Cannot reach the provider. Check your network connection." => {
                Self::CannotReachTheProviderCheckYourNetworkConnection
            }
            "Cannot encode audio upload." => Self::CannotEncodeAudioUpload,
            "Cannot encode translation input." => Self::CannotEncodeTranslationInput,
            "Live caption status unavailable." => Self::LiveCaptionStatusUnavailable,
            "Diagnostics unavailable." => Self::DiagnosticsUnavailable,
            "Live status unavailable." => Self::LiveStatusUnavailable,
            "Unsupported live audio format." => Self::UnsupportedLiveAudioFormat,
            "Cannot read live audio checkpoint." => Self::CannotReadLiveAudioCheckpoint,
            "Cannot read live audio. Recording continues." => {
                Self::CannotReadLiveAudioRecordingContinues
            }
            "Speech provider unavailable." => Self::SpeechProviderUnavailable,
            "Cannot encode diagnostics." => Self::CannotEncodeDiagnostics,
            "Cannot inspect storage for cleanup. Check permissions." => {
                Self::CannotInspectStorageForCleanupCheckPermissions
            }
            "Cannot inspect storage." => Self::CannotInspectStorage,
            "Cannot inspect cleanup recovery." => Self::CannotInspectCleanupRecovery,
            "Cannot restore interrupted cleanup." => Self::CannotRestoreInterruptedCleanup,
            "Cannot restore files after interrupted cleanup." => {
                Self::CannotRestoreFilesAfterInterruptedCleanup
            }
            "Cannot finish cleanup recovery." => Self::CannotFinishCleanupRecovery,
            "Cannot read cleanup journal." => Self::CannotReadCleanupJournal,
            "Invalid cleanup journal." => Self::InvalidCleanupJournal,
            "Invalid cleanup journal name." => Self::InvalidCleanupJournalName,
            "Invalid cleanup destination." => Self::InvalidCleanupDestination,
            "Invalid course." => Self::InvalidCourse,
            "Invalid lecture." => Self::InvalidLecture,
            "Cannot inspect course files." => Self::CannotInspectCourseFiles,
            "Cannot prepare cleanup journal." => Self::CannotPrepareCleanupJournal,
            "Cannot locate the Windows app data folder." => {
                Self::CannotLocateTheWindowsAppDataFolder
            }
            "Cannot locate the Windows Documents folder." => {
                Self::CannotLocateTheWindowsDocumentsFolder
            }
            "Cannot create the app data folder. Check permissions." => {
                Self::CannotCreateTheAppDataFolderCheckPermissions
            }
            "Cannot create the library folder. Check Documents permissions." => {
                Self::CannotCreateTheLibraryFolderCheckDocumentsPermissions
            }
            "Invalid course or lecture identifier." => Self::InvalidCourseOrLectureIdentifier,
            "Cannot create the lecture folder." => Self::CannotCreateTheLectureFolder,
            "Cannot encode lecture metadata." => Self::CannotEncodeLectureMetadata,
            "Cannot encode transcript." => Self::CannotEncodeTranscript,
            "Invalid local file path." => Self::InvalidLocalFilePath,
            "Cannot write a local file. Check disk space." => {
                Self::CannotWriteALocalFileCheckDiskSpace
            }
            "Cannot write the file. Check available disk space." => {
                Self::CannotWriteTheFileCheckAvailableDiskSpace
            }
            "Cannot save file." => Self::CannotSaveFile,
            "Cannot update the file. Check whether another app is using it." => {
                Self::CannotUpdateTheFileCheckWhetherAnotherApp
            }
            "Cannot save lecture snapshot." => Self::CannotSaveLectureSnapshot,
            "Storage usage is unavailable. Check folder permissions." => {
                Self::StorageUsageIsUnavailableCheckFolderPermissions
            }
            "Cannot read available CPU resources." => Self::CannotReadAvailableCpuResources,
            "Cannot manage local speech performance." => Self::CannotManageLocalSpeechPerformance,
            "Cannot check local speech worker." => Self::CannotCheckLocalSpeechWorker,
            "Cannot change local speech performance." => Self::CannotChangeLocalSpeechPerformance,
            "Invalid local speech audio." => Self::InvalidLocalSpeechAudio,
            "Unsupported local speech audio." => Self::UnsupportedLocalSpeechAudio,
            "Cannot read local speech audio." => Self::CannotReadLocalSpeechAudio,
            "Local recognition unavailable." => Self::LocalRecognitionUnavailable,
            "Local speech worker unavailable." => Self::LocalSpeechWorkerUnavailable,
            "Cannot start local speech recognition. Reinstall LectureRelay." => {
                Self::CannotStartLocalSpeechRecognitionReinstallLecturerelay
            }
            "Local speech input unavailable." => Self::LocalSpeechInputUnavailable,
            "Local speech output unavailable." => Self::LocalSpeechOutputUnavailable,
            "Cannot set speech glossary." => Self::CannotSetSpeechGlossary,
            "Invalid local streaming response." => Self::InvalidLocalStreamingResponse,
            "Invalid local speech chunk." => Self::InvalidLocalSpeechChunk,
            "Cannot contain local speech worker." => Self::CannotContainLocalSpeechWorker,
            "A live summary is being processed. Wait for it to finish or turn summaries off." => {
                Self::ALiveSummaryIsBeingProcessedWaitFor
            }
            "Wait for the model download to finish." => Self::WaitForTheModelDownloadToFinish,
            "Wait for the five-second audio test to finish." => {
                Self::WaitForTheFiveSecondAudioTestTo
            }
            "Choose a valid summary service, model and an interval of 2, 4 or 5 minutes." => {
                Self::ChooseAValidSummaryServiceModelAndAn
            }
            "Before enabling cloud summaries, allow the selected provider to receive the matching English transcript and course background." => {
                Self::BeforeEnablingCloudSummariesAllowTheSelectedProvider
            }
            "Cannot read live summary settings." => Self::CannotReadLiveSummarySettings,
            "Cannot save live summary settings." => Self::CannotSaveLiveSummarySettings,
            "Cannot turn off the old local live summary setting." => {
                Self::CannotTurnOffTheOldLocalLiveSummary
            }
            "Summary processing was interrupted. The source text is saved; retry on this card." => {
                Self::SummaryProcessingWasInterruptedTheSourceTextIs
            }
            "Another summary is being processed. Please wait." => {
                Self::AnotherSummaryIsBeingProcessedPleaseWait
            }
            "Cannot read the summary rate-limit status." => {
                Self::CannotReadTheSummaryRateLimitStatus
            }
            "The summary service is still rate limited. Recording and captions continue to be saved; try again later." => {
                Self::TheSummaryServiceIsStillRateLimitedRecording
            }
            "The summary format is incomplete. Try again; incomplete results are not shown as key points." => {
                Self::TheSummaryFormatIsIncompleteTryAgainIncomplete
            }
            "The summary length or citations are invalid. Try again." => {
                Self::TheSummaryLengthOrCitationsAreInvalidTry
            }
            "The summary cites source text that does not exist. The source is preserved; try again." => {
                Self::TheSummaryCitesSourceTextThatDoesNot
            }
            "Set up and enable live summaries first." => Self::SetUpAndEnableLiveSummariesFirst,
            "Save and test an API key in live summary settings first. Recording and captions are not affected." => {
                Self::SaveAndTestAnApiKeyInLive
            }
            "A summary is still unfinished. Retry it on its card; new source text continues to be saved." => {
                Self::ASummaryIsStillUnfinishedRetryItOn
            }
            "There is no newly finalized English yet. Try again later." => {
                Self::ThereIsNoNewlyFinalizedEnglishYetTry
            }
            "The summary was cancelled or its settings changed. The unfinished section is kept; you can retry later." => {
                Self::TheSummaryWasCancelledOrItsSettingsChanged
            }
            "The summary timed out. The source text is saved; you can retry later." => {
                Self::TheSummaryTimedOutTheSourceTextIs
            }
            "Summary card not found." => Self::SummaryCardNotFound,
            "The source text was not found." => Self::TheSourceTextWasNotFound,
            "The recording cannot be read right now. Try again later." => {
                Self::TheRecordingCannotBeReadRightNowTry
            }
            "This recording format does not support section playback." => {
                Self::ThisRecordingFormatDoesNotSupportSectionPlayback
            }
            "This part of the recording is not finished yet. Play it again later." => {
                Self::ThisPartOfTheRecordingIsNotFinished
            }
            "Cannot locate the recording section." => Self::CannotLocateTheRecordingSection,
            "Reading the recording section failed. Try again later." => {
                Self::ReadingTheRecordingSectionFailedTryAgainLater
            }
            "Cannot read the recording section." => Self::CannotReadTheRecordingSection,
            "Save the API key, then select Test summary connection; summaries can be enabled after it succeeds." => {
                Self::SaveTheApiKeyThenSelectTestSummary
            }
            "The summary connection test timed out. Check your network and try again." => {
                Self::TheSummaryConnectionTestTimedOutCheckYour
            }
            "The key or summary settings changed during the test. Test again." => {
                Self::TheKeyOrSummarySettingsChangedDuringThe
            }
            "Cannot open this service page." => Self::CannotOpenThisServicePage,
            "Cannot open the system browser. Check your default browser setting." => {
                Self::CannotOpenTheSystemBrowserCheckYourDefault
            }
            "The source text or assistance language changed. Summarize again and review it." => {
                Self::TheSourceTextOrAssistanceLanguageChangedSummarize
            }
            "There is no newly finalized English yet." => Self::ThereIsNoNewlyFinalizedEnglishYet,
            "The summary sources are duplicated. Select them again." => {
                Self::TheSummarySourcesAreDuplicatedSelectThemAgain
            }
            "The source text changed. Try again." => Self::TheSourceTextChangedTryAgain,
            "This source text already has a summary. Check the existing card or retry." => {
                Self::ThisSourceTextAlreadyHasASummaryCheck
            }
            "This summary card was not found." => Self::ThisSummaryCardWasNotFound,
            "This section is being summarized. Please wait." => {
                Self::ThisSectionIsBeingSummarizedPleaseWait
            }
            "The source text was deleted, so this summary cannot be retried." => {
                Self::TheSourceTextWasDeletedSoThisSummary
            }
            "The source text changed, so the old result was not used as the latest summary. Try again." => {
                Self::TheSourceTextChangedSoTheOldResult
            }
            "The API key is invalid or revoked. Replace it and test again." => {
                Self::TheApiKeyIsInvalidOrRevokedReplace
            }
            "Account balance or API billing is not ready. Check the provider account; recording continues to be saved." => {
                Self::AccountBalanceOrApiBillingIsNotReady
            }
            "The account lacks access. Check the service region, model permissions and account status." => {
                Self::TheAccountLacksAccessCheckTheServiceRegion
            }
            "The selected model is unavailable. Choose another model in advanced settings and test again." => {
                Self::TheSelectedModelIsUnavailableChooseAnotherModel
            }
            "The free allowance is used up or requests are limited. Check the account quota and try again later; recording continues to be saved." => {
                Self::TheFreeAllowanceIsUsedUpOrRequests
            }
            "The model does not support these summary parameters. Use the recommended model or check the advanced model settings." => {
                Self::TheModelDoesNotSupportTheseSummaryParameters
            }
            "The provider is temporarily unavailable. The source text is saved; try again later." => {
                Self::TheProviderIsTemporarilyUnavailableTheSourceText
            }
            "The summary request did not complete. Check the account and model settings. The source text is saved." => {
                Self::TheSummaryRequestDidNotCompleteCheckThe
            }
            "Cannot reach the summary service or the request timed out. Check your network and try again; recording continues to be saved." => {
                Self::CannotReachTheSummaryServiceOrTheRequest
            }
            "The summary did not finish before the app closed. The source text is saved; you can retry it." => {
                Self::TheSummaryDidNotFinishBeforeTheApp
            }
            "A transcript is needed to answer from lecture evidence." => {
                Self::ATranscriptIsNeededToAnswerFromLecture
            }
            "Cannot read summary language." => Self::CannotReadSummaryLanguage,
            "Cannot check summary references." => Self::CannotCheckSummaryReferences,
            "Cannot read live summaries." => Self::CannotReadLiveSummaries,
            "Cannot read saved summary cards." => Self::CannotReadSavedSummaryCards,
            "Cannot mark an outdated summary." => Self::CannotMarkAnOutdatedSummary,
            "Cannot reserve a summary." => Self::CannotReserveASummary,
            "Cannot check summary coverage." => Self::CannotCheckSummaryCoverage,
            "Cannot check saved summary sources." => Self::CannotCheckSavedSummarySources,
            "Cannot encode summary sources." => Self::CannotEncodeSummarySources,
            "Cannot save summary input. No request was sent." => {
                Self::CannotSaveSummaryInputNoRequestWasSent
            }
            "Cannot save summary input." => Self::CannotSaveSummaryInput,
            "Cannot retry summary." => Self::CannotRetrySummary,
            "Cannot save live summary." => Self::CannotSaveLiveSummary,
            "Cannot encode summary." => Self::CannotEncodeSummary,
            "Cannot save summary outcome." => Self::CannotSaveSummaryOutcome,
            "Cannot save connection test." => Self::CannotSaveConnectionTest,
            "Cannot clear connection test." => Self::CannotClearConnectionTest,
            "Cannot read connection test." => Self::CannotReadConnectionTest,
            "App closed before processing finished. Saved results are preserved." => {
                Self::AppClosedBeforeProcessingFinishedSavedResultsAre
            }
            "Cannot start live summary migration." => Self::CannotStartLiveSummaryMigration,
            "Live summary migration failed." => Self::LiveSummaryMigrationFailed,
            "Cannot commit live summary migration." => Self::CannotCommitLiveSummaryMigration,
            "Cannot recover live summaries." => Self::CannotRecoverLiveSummaries,
            "Cannot prepare translation language migration." => {
                Self::CannotPrepareLanguageMigration
            }
            "Cannot start translation language migration." => Self::CannotStartLanguageMigration,
            "Translation language migration failed." => Self::LanguageMigrationFailed,
            "Translation language migration failed its integrity check. Existing database was preserved." => {
                Self::LanguageMigrationFailedItsIntegrityCheck
            }
            "Cannot commit translation language migration." => Self::CannotCommitLanguageMigration,
            "Cannot start speaker label migration." => Self::CannotStartSpeakerMigration,
            "Speaker label migration failed." => Self::SpeakerMigrationFailed,
            "Cannot commit speaker label migration." => Self::CannotCommitSpeakerMigration,
            "Cannot start course archive migration." => Self::CannotStartArchiveMigration,
            "Course archive migration failed." => Self::ArchiveMigrationFailed,
            "Cannot commit course archive migration." => Self::CannotCommitArchiveMigration,
            "Cannot archive the course." => Self::CannotArchiveCourse,
            "Enter a speaker name of up to 40 characters." => Self::SpeakerNameIsEmptyOrTooLong,
            "Cannot save the speaker." => Self::CannotSaveSpeaker,
            "Cannot read speakers." => Self::CannotReadSpeakers,
            "Download the speaker model in Settings → AI & models → Local models first." => {
                Self::DownloadTheSpeakerModelFirst
            }
            "Transcribe the lecture before detecting speakers." => {
                Self::TranscribeBeforeDetectingSpeakers
            }
            "Speaker detection failed. The transcript is unchanged." => {
                Self::SpeakerDetectionFailedTranscriptIsUnchanged
            }
            "Enter an https link to an audio or video file." => {
                Self::EnterAnHttpsLinkToAnAudioOrVideoFile
            }
            "Cannot download that link. Check the link and your connection." => {
                Self::CannotDownloadThatLinkCheckItAndYourConnection
            }
            "That link opens a web page, not an audio or video file. Video sites such as YouTube are not supported." => {
                Self::ThatLinkOpensWebPageNotMediaFile
            }
            "The download was interrupted. Try again." => Self::MediaDownloadWasInterruptedTryAgain,
            "Cannot switch to that device. Recording continues on the current one." => {
                Self::CannotSwitchAudioDeviceTheCurrentOneKeepsRecording
            }
            _ => Self::OperationFailed,
        }
    }
}
