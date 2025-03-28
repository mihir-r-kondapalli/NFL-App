#include <iostream>
#include <fstream>
#include <unordered_map>
#include <vector>
#include <random> 
#include "json.hpp"
#include <chrono>

using json = nlohmann::json;
using namespace std;

const int SEED_VALUE = 25;

// Function to load JSON sample data into the unordered_map
void loadSampleData(const string& filename, unordered_map<string, vector<int>>& sample_data) {
    ifstream file(filename);
    if (!file) {
        cerr << "Error opening file: " << filename << endl;
        return;
    }

    json jsonData;
    file >> jsonData;  // Load JSON from file

    // Iterate over keys in JSON
    for (auto& [key, values] : jsonData.items()) {
        vector<int> samples = values.get<vector<int>>();
        sample_data[key] = move(samples);  // Store in hash map
    }

    cout << "Loaded " << sample_data.size() << " keys from " << filename << endl;
}

// Function to display loaded sample data
void printSampleData(unordered_map<string, vector<int>>& sample_data) {
    for (const auto& [key, values] : sample_data) {
        cout << key << ": [";
        for (size_t i = 0; i < min(values.size(), size_t(5)); i++) {
            cout << values[i] << (i < 4 ? ", " : "...");
        }
        cout << "] (Total: " << values.size() << " samples)" << endl;
    }
}

struct pair_hash {
    size_t operator()(const pair<string, int>& p) const {
        return hash<string>()(p.first) ^ hash<int>()(p.second);
    }
};

void saveDataToCSV(string filename, unordered_map<pair<string, int>, double, pair_hash>& data){

    ofstream file(filename);
    if (!file) {
        cerr << "Error opening file!" << endl;
        return;
    }
    file << "DownAndDistance,Yardline,Expected Points Added (EPA)\n";
    for (const auto& [key, value] : data) {
        file << key.first << "," << key.second << "," << value << "\n";
    }
    file.close();
    cout << "CSV file saved successfully!\n";
}

// ACTUAL SIMULATOR METHODS

// Number of simulations for each down, distance, and yardline

const int N = 100;

unordered_map<pair<string, int>, double, pair_hash> run_epas;
unordered_map<pair<string, int>, double, pair_hash> pass_epas;
unordered_map<pair<string, int>, double, pair_hash> max_epas;

vector<double> probs(99);
vector<pair<int, int>> distrs(99);   // first int is primary sample, second int is secondary sample

int get_val(string down_and_distance, unordered_map<string, vector<int>>& sample_data, mt19937& rng){
    vector<int> sample = sample_data[down_and_distance];
    if(sample.size()!=0){
        int val = sample[rng() % sample.size()];
        return val;
    }
    if(down_and_distance[0]!='1'){    // If no instances, recursively return data from previous down
        down_and_distance[0]--;
        return get_val(down_and_distance, sample_data, rng);
    }
    
    return get_val("1-10", sample_data, rng);  // If no instances at all, return data from 1st and 10
}

double get_epa_val(int val, int down, int yards_to_go, int yardline){
    if(val < -100){
        return 0;
    }

    int new_yardline = yardline - val;
    if(new_yardline <= 0){
        return 6.957; // TD + EXP(extra point)    (% conversion for 2pt is 47.3)
    }
    
    if(new_yardline >= 100){
        return -2;    // Placeholder for safety
    }

    int new_down = down+1;
    int new_yards_to_go = yards_to_go - val;

    if(new_yards_to_go <= 0){         // First down
        new_down = 1;
        new_yards_to_go = (10 <= yardline) ? 10 : yardline;
    }
    else if(new_yards_to_go > 0 && new_down>4){  // Turnover on downs
        return 0;
    }

    string new_down_and_distance = to_string(new_down) + "-" + to_string(yards_to_go);
    return max_epas[make_pair(new_down_and_distance, new_yardline)];
}


void run_simulation(vector<unordered_map<string, vector<int>>>& sample_datas, mt19937& mt1){
    
    uniform_real_distribution<double> dist(0.0, 1.0);  // Generates numbers in [0,1]

    int yardline;   // 1 means at opponents goaline
    int down;
    int yards_to_go;
    for(yardline = 1; yardline<100; yardline++){
        for(down = 4; down>0; down--){
            for(yards_to_go = 1; yards_to_go <= 20; yards_to_go++){
                if(yards_to_go > yardline) continue;
                string down_and_distance = to_string(down) + "-" + to_string(yards_to_go);
                double epa_rush_val = 0;
                double epa_pass_val = 0;

                int n = N;
                if(down == 1 && yards_to_go != 10 && yards_to_go != yardline) n = 50; // Cuts down on unnecessary runs for uncommon downs

                for(int i = 0; i<n; i++){
                    int sample_num = (dist(mt1) < probs[yardline-1]) ? distrs[yardline-1].second : distrs[yardline-1].first;
                    epa_rush_val += get_epa_val(get_val(down_and_distance, sample_datas[sample_num], mt1), down, yards_to_go, yardline);
                    epa_pass_val += get_epa_val(get_val(down_and_distance, sample_datas[sample_num+1], mt1), down, yards_to_go, yardline);
                }
                epa_rush_val = epa_rush_val/n;
                epa_pass_val = epa_pass_val/n;

                pair<string, int> ddy = make_pair(down_and_distance, yardline);

                run_epas[ddy] = epa_rush_val;
                pass_epas[ddy] = epa_pass_val;
                max_epas[ddy] = max(epa_rush_val, epa_pass_val);

                cout << down_and_distance << " " << yardline << ": " << epa_rush_val << ", " << epa_pass_val << endl;
            }
        }
    }
}


int main(int argc, char* argv[]) {

    vector<string> filenames = {"sample_data/rush_sample_yl21-99.json", "sample_data/pass_sample_yl21-99.json",
                                "sample_data/rush_sample_yl11-20.json", "sample_data/pass_sample_yl11-20.json",
                                "sample_data/rush_sample_yl1-10.json", "sample_data/pass_sample_yl1-10.json"};

    vector<unordered_map<string, vector<int>>> sample_datas(6);

    int seed_value = SEED_VALUE;

    if(argc == 2){
        seed_value = stoi(argv[1]);
    }

    mt19937 mt1(seed_value);

    for(int i = 0; i<sample_datas.size(); i++){
        loadSampleData(filenames[i], sample_datas[i]);
        //printSampleData(sample_datas[i]);
    }

    cout << "Data loaded correctly!" << endl;

    // Initializing distribution choices and probabilities

    for(int i = 0; i<probs.size(); i++){
        int yardline = i+1;
        int first_dist, second_distr;

        if(yardline >= 1 && yardline <=10){
            first_dist = 4;
            second_distr = 2;
        }else if(yardline >= 11 && yardline <= 15){
            first_dist = 2;
            second_distr = 4;
        }else if(yardline >= 15 && yardline <= 20){
            first_dist = 2;
            second_distr = 0;
        }else if(yardline >= 21 && yardline <= 99){
            first_dist = 0;
            second_distr = 2;
        }

        distrs[i] = make_pair(first_dist, second_distr);
        probs[i] = 0;
    }

    probs[8-1] = 0.05; probs[9-1] = 0.15; probs[10-1] = 0.4;
    probs[13-1] = 0.05; probs[12-1] = 0.15; probs[11-1] = 0.4;
    probs[18-1] = 0.05; probs[19-1] = 0.15; probs[20-1] = 0.4;
    probs[23-1] = 0.05; probs[22-1] = 0.15; probs[21-1] = 0.4;

    cout << "Probabilities initialized!" << endl;


    auto start = chrono::high_resolution_clock::now();

    run_simulation(sample_datas, mt1);

    saveDataToCSV("epas/run_epas.csv", run_epas);
    saveDataToCSV("epas/pass_epas.csv", pass_epas);
    saveDataToCSV("epas/max_epas.csv", max_epas);

    auto end = chrono::high_resolution_clock::now();

    chrono::duration<double> elapsed = end - start;
    cout << endl << "Execution time: " << elapsed.count() << " seconds" << endl;

    return 0;
}