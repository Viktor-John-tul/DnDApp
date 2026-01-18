import SwiftUI

struct EditNotesView: View {
    @Environment(\.dismiss) var dismiss
    @Bindable var character: RPGCharacter
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Session Log & Scratchpad") {
                    // TextEditor grows to fill space
                    TextEditor(text: $character.notes)
                        .frame(minHeight: 300)
                }
            }
            .navigationTitle("Edit Notes")
            .toolbar {
                Button("Done") { dismiss() }
            }
        }
    }
}
